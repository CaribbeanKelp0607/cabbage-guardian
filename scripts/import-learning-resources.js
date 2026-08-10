/*
 * 将 Codex 已整理的图片资源直传到 CloudBase。
 * 仅从当前进程环境变量读取密钥；不要把密钥写进清单或提交到 Git。
 */
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const cloudbase = require('@cloudbase/node-sdk')

const required = ['TCB_ENV_ID', 'TCB_SECRET_ID', 'TCB_SECRET_KEY']
const value = name => String(process.env[name] || '').trim()
const sha = input => crypto.createHash('sha256').update(input).digest('hex')
const clean = (input, max = 8000) => String(input || '').trim().slice(0, max)
const slug = value => String(value || '').trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '-').slice(0, 80) || 'resource'
const idFor = (prefix, familyId, input) => `${prefix}-${crypto.createHash('sha1').update(`${familyId}:${input}`).digest('hex').slice(0, 12)}`
const titleKey = title => clean(title, 160).split(/[（(]/)[0].replace(/[^a-z0-9]/gi, '').toLowerCase()

function loadLocalEnvironment() {
  const localFile = path.join(process.cwd(), '.env.resource-import.local')
  if (!fs.existsSync(localFile)) return
  fs.readFileSync(localFile, 'utf8').split(/\r?\n/).forEach(line => {
    const matched = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!matched || process.env[matched[1]]) return
    process.env[matched[1]] = matched[2].replace(/^['"]|['"]$/g, '')
  })
}

function arg(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : ''
}

function usage() {
  console.log('用法：npm run import:resources -- --manifest .resource-import.local.json [--family-id 家庭ID] [--apply]')
  console.log('不带 --apply 只预览，不会上传文件或写入数据库。')
}

async function getFamily(db, familyId) {
  if (familyId) {
    const result = await db.collection('families').doc(familyId).get()
    const family = Array.isArray(result.data) ? result.data[0] : result.data
    if (!family) throw new Error('指定的家庭不存在')
    return family
  }
  const result = await db.collection('families').limit(2).get()
  if (result.data.length !== 1) throw new Error('当前环境不是唯一家庭，请通过 --family-id 明确指定导入目标')
  return result.data[0]
}

function readManifest(file) {
  if (!file) throw new Error('缺少 --manifest 参数')
  const manifest = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'))
  if (!Array.isArray(manifest.resources) || !manifest.resources.length) throw new Error('清单中至少需要一项 resources')
  if (manifest.resources.length > 120) throw new Error('单次最多导入 120 张图片')
  return manifest
}

function prepare(manifest, familyId) {
  const libraryLabel = clean(manifest.library && manifest.library.label, 30)
  const libraryId = clean(manifest.library && manifest.library.id, 60) || idFor('library', familyId, libraryLabel)
  const categoryLabel = clean(manifest.category && manifest.category.label, 30)
  const categoryId = clean(manifest.category && manifest.category.id, 60) || idFor('category', familyId, `${libraryId}:${categoryLabel}`)
  if (!libraryLabel || !categoryLabel) throw new Error('清单必须包含 library.label 和 category.label')
  return manifest.resources.map((raw, index) => {
    const file = path.resolve(clean(raw.file, 1000))
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`第 ${index + 1} 项图片不存在：${file}`)
    const sourceHash = sha(fs.readFileSync(file))
    const ext = path.extname(file).toLowerCase() || '.jpg'
    const title = clean(raw.title, 160) || `未命名资源 ${String(index + 1).padStart(2, '0')}`
    return {
      file, sourceHash, title, content: clean(raw.content), libraryId, libraryLabel, categoryId, categoryLabel,
      unit: Number(raw.unit) || 0,
      // 同一张来源图片可以拆成多项学习任务；资源 ID 还需包含标题，避免相互覆盖。
      id: `resource-import-${sha(`${sourceHash}:${titleKey(title)}`).slice(0, 24)}`,
      cloudPath: `resource-images/import/${sourceHash}${ext}`
    }
  })
}

async function main() {
  if (process.argv.includes('--help')) return usage()
  loadLocalEnvironment()
  const missing = required.filter(name => !value(name))
  if (missing.length) throw new Error(`缺少本机环境变量：${missing.join('、')}`)
  const manifest = readManifest(arg('--manifest'))
  const apply = process.argv.includes('--apply')
  const app = cloudbase.init({ env: value('TCB_ENV_ID'), secretId: value('TCB_SECRET_ID'), secretKey: value('TCB_SECRET_KEY') })
  const db = app.database()
  const family = await getFamily(db, arg('--family-id'))
  const preparedEntries = prepare(manifest, family._id)
  const existingResult = await db.collection('learningResources').where({ subject: preparedEntries[0].libraryId, category: preparedEntries[0].categoryId, enabled: true }).get()
  const existingByTitle = new Map((existingResult.data || []).map(item => [titleKey(item.title), item]))
  // 标题相同代表同一份导入资源：沿用既有 ID 覆盖更新，避免资料卡重复。
  const entries = preparedEntries.map(item => {
    const existing = existingByTitle.get(titleKey(item.title))
    return existing ? { ...item, id: existing._id } : item
  })
  console.log(`目标家庭：${family._id}；待导入 ${entries.length} 项；分类：${preparedEntries[0].libraryLabel} / ${preparedEntries[0].categoryLabel}`)
  entries.forEach((item, index) => console.log(`${index + 1}. ${item.title} <- ${item.file}`))
  if (!apply) return console.log('预览完成。确认无误后追加 --apply 执行上传和入库。')

  const failures = []
  for (let index = 0; index < entries.length; index += 1) {
    const item = entries[index]
    try {
      const upload = await app.uploadFile({ cloudPath: item.cloudPath, fileContent: fs.createReadStream(item.file) })
      await db.collection('learningResources').doc(item.id).set({
        familyId: family._id,
        source: 'codex-import',
        sourceHash: item.sourceHash,
        libraryId: item.libraryId,
        libraryLabel: item.libraryLabel,
        category: item.categoryId,
        categoryLabel: item.categoryLabel,
        subject: item.libraryId,
        unit: item.unit,
        title: item.title,
        content: item.content,
        image: upload.fileID,
        enabled: true,
        importedAt: new Date(),
        updatedAt: new Date()
      })
      console.log(`✓ ${index + 1}/${entries.length} 已导入：${item.title}`)
    } catch (error) {
      failures.push({ title: item.title, error: error.message || String(error) })
      console.error(`✗ ${index + 1}/${entries.length} 失败：${item.title} - ${error.message || error}`)
    }
  }
  if (failures.length) {
    console.error(`完成，但有 ${failures.length} 项失败。`)
    process.exitCode = 1
  } else console.log(`导入完成：${entries.length} 项资源已写入云端。`)
}

main().catch(error => { console.error(`导入未执行：${error.message || error}`); process.exitCode = 1 })
