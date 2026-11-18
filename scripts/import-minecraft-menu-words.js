// Import the legible words from the supplied Minecraft menu as separate text cards.
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const cloudbase = require('@cloudbase/node-sdk')

const words = [
  ['Minecraft', '我的世界（游戏名称）', 'Minecraft Realms：我的世界领域'],
  ['Java', 'Java（编程语言名称）', 'Java Edition：Java 版'],
  ['Edition', '版本', 'Java Edition：Java 版'],
  ['Stay', '保持；停留', '图片右上角后续文字被截断。'],
  ['Singleplayer', '单人游戏', '选择单人游戏模式。'],
  ['Multiplayer', '多人游戏', '选择多人游戏模式。'],
  ['Realms', '领域；专用多人游戏服务器', 'Minecraft Realms：我的世界领域。'],
  ['Options', '选项；设置', '打开游戏设置。'],
  ['Quit', '退出', 'Quit Game：退出游戏。'],
  ['Game', '游戏', 'Quit Game：退出游戏。']
]

for (const line of fs.readFileSync(path.join(process.cwd(), '.env.resource-import.local'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
}
const app = cloudbase.init({ env: process.env.TCB_ENV_ID, secretId: process.env.TCB_SECRET_ID, secretKey: process.env.TCB_SECRET_KEY })
const db = app.database()

async function main() {
  const families = await db.collection('families').limit(2).get()
  if (families.data.length !== 1) throw new Error('当前环境不是唯一家庭，无法确定导入目标')
  const familyId = families.data[0]._id
  const entries = words.map(([title, translation, context], index) => ({
    id: `minecraft-menu-${crypto.createHash('sha256').update(`${familyId}:${title}`).digest('hex').slice(0, 24)}`,
    familyId, source: 'family', libraryId: 'english', libraryLabel: '英语资料库', subject: 'english',
    category: 'minecraft-menu-words', categoryLabel: '我的世界菜单单词', unit: index + 1,
    title, content: `${title}\n${translation}\n\n${context}`, image: '', enabled: true
  }))
  console.log(`目标：英语资料库 / 我的世界菜单单词，${entries.length} 项`)
  if (!process.argv.includes('--apply')) return entries.forEach(item => console.log(item.title))
  for (const entry of entries) {
    const { id, ...data } = entry
    await db.collection('learningResources').doc(id).set({ ...data, updatedAt: new Date() })
    console.log(`已保存：${entry.title}`)
  }
  const result = await db.collection('learningResources').where({ familyId, category: 'minecraft-menu-words', enabled: true }).get()
  const found = new Set((result.data || []).map(item => item.title))
  const missing = entries.filter(item => !found.has(item.title))
  if (missing.length) throw new Error(`保存后未找到：${missing.map(item => item.title).join('、')}`)
  console.log(`核验成功：${entries.length} 项均可读取`)
}
main().catch(error => { console.error(error.message || error); process.exitCode = 1 })
