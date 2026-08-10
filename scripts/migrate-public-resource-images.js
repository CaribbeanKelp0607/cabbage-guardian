/* 将公共资源图片从本地 assets 上传到 CloudBase 云存储，并更新资源及历史任务快照。 */
const fs = require('fs')
const path = require('path')
const cloudbase = require('@cloudbase/node-sdk')

function loadLocalEnvironment() {
  const localFile = path.join(process.cwd(), '.env.resource-import.local')
  if (!fs.existsSync(localFile)) return
  fs.readFileSync(localFile, 'utf8').split(/\r?\n/).forEach(line => {
    const matched = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (matched && !process.env[matched[1]]) process.env[matched[1]] = matched[2].replace(/^['"]|['"]$/g, '')
  })
}

const files = [
  ['minecraft-english-block-001', 'block.jpg'], ['minecraft-english-block-002', 'stone.jpg'],
  ['minecraft-english-block-003', 'grass-block.jpg'], ['minecraft-english-block-004', 'dirt.jpg'],
  ['minecraft-english-block-005', 'cobblestone.jpg'], ['minecraft-english-block-006', 'sand.jpg'],
  ['minecraft-english-block-007', 'gravel.jpg'], ['minecraft-english-block-008', 'clay.jpg']
]

async function main() {
  loadLocalEnvironment()
  const missing = ['TCB_ENV_ID', 'TCB_SECRET_ID', 'TCB_SECRET_KEY'].filter(key => !process.env[key])
  if (missing.length) throw new Error(`缺少本机环境变量：${missing.join('、')}`)
  const apply = process.argv.includes('--apply')
  const app = cloudbase.init({ env: process.env.TCB_ENV_ID, secretId: process.env.TCB_SECRET_ID, secretKey: process.env.TCB_SECRET_KEY })
  const db = app.database()
  console.log(`将迁移 ${files.length} 张公共资源图片到 CloudBase 云存储。`)
  if (!apply) return console.log('预览完成。确认后追加 --apply 执行迁移。')

  const imageMap = {}
  for (const [resourceId, filename] of files) {
    const localFile = path.join(process.cwd(), 'assets', 'english-cards', filename)
    if (!fs.existsSync(localFile)) throw new Error(`缺少本地图片：${filename}`)
    const current = await db.collection('learningResources').doc(resourceId).get()
    const resource = Array.isArray(current.data) ? current.data[0] : current.data
    if (!resource || resource.familyId) throw new Error(`公共资源校验失败：${resourceId}`)
    const uploaded = await app.uploadFile({ cloudPath: `resource-images/public/${resourceId}.jpg`, fileContent: fs.createReadStream(localFile) })
    imageMap[resourceId] = uploaded.fileID
    await db.collection('learningResources').doc(resourceId).update({ image: uploaded.fileID, updatedAt: new Date() })
    console.log(`✓ ${resourceId}`)
  }

  const taskResult = await db.collection('dailyTasks').limit(100).get()
  let taskCount = 0
  for (const task of taskResult.data || []) {
    const snapshot = task.resourceSnapshot || {}
    if (!imageMap[snapshot.id]) continue
    await db.collection('dailyTasks').doc(task._id).update({ resourceSnapshot: { ...snapshot, image: imageMap[snapshot.id] }, updatedAt: new Date() })
    taskCount += 1
  }
  console.log(`迁移完成：${files.length} 张资源图片、${taskCount} 条历史任务快照已更新。`)
}

main().catch(error => { console.error(`迁移未执行：${error.message || error}`); process.exitCode = 1 })
