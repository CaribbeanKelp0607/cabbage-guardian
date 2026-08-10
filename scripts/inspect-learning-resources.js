/* 仅用于本机排查导入结果；密钥仍只从被忽略的本机环境文件读取。 */
const fs = require('fs')
const path = require('path')
const cloudbase = require('@cloudbase/node-sdk')

for (const line of fs.readFileSync(path.join(process.cwd(), '.env.resource-import.local'), 'utf8').split(/\r?\n/)) {
  const matched = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
  if (matched) process.env[matched[1]] = matched[2].replace(/^['"]|['"]$/g, '')
}
const app = cloudbase.init({ env: process.env.TCB_ENV_ID, secretId: process.env.TCB_SECRET_ID, secretKey: process.env.TCB_SECRET_KEY })
const db = app.database()

async function main() {
  const families = await db.collection('families').limit(2).get()
  const family = families.data[0]
  const result = await db.collection('learningResources').where({ subject: 'english', category: 'joinin-grade3-spelling', enabled: true }).limit(120).get()
  const items = Array.isArray(result.data) ? result.data : []
  console.log(`拼写任务记录数：${items.length}`)
  items.slice(0, 5).forEach(item => console.log(`${item._id} | ${item.title} | ${item.category} | ${item.subject}`))
}
main().catch(error => { console.error(error.message || error); process.exitCode = 1 })
