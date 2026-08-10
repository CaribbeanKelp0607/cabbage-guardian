/* 删除英语资料库中已废弃的“三上单词表”资源；默认仅预览，追加 --apply 后才会删除。 */
const fs = require('fs')
const path = require('path')
const cloudbase = require('@cloudbase/node-sdk')

for (const line of fs.readFileSync(path.join(process.cwd(), '.env.resource-import.local'), 'utf8').split(/\r?\n/)) {
  const matched = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
  if (matched) process.env[matched[1]] = matched[2].replace(/^['"]|['"]$/g, '')
}

const app = cloudbase.init({ env: process.env.TCB_ENV_ID, secretId: process.env.TCB_SECRET_ID, secretKey: process.env.TCB_SECRET_KEY })
const db = app.database()
const filter = { subject: 'english', category: 'joinin' }

async function main() {
  const result = await db.collection('learningResources').where(filter).limit(100).get()
  const items = Array.isArray(result.data) ? result.data : []
  console.log(`匹配“三上单词表”的资源：${items.length} 项`)
  items.forEach(item => console.log(`- ${item._id} | ${item.title} | ${item.category}`))
  if (!process.argv.includes('--apply')) {
    console.log('这是预览；确认无误后追加 --apply 执行删除。')
    return
  }
  await Promise.all(items.map(item => db.collection('learningResources').doc(item._id).remove()))
  console.log(`已删除 ${items.length} 项“三上单词表”资源；未查询或删除 joinin-grade3-spelling。`)
}

main().catch(error => { console.error(error.message || error); process.exitCode = 1 })
