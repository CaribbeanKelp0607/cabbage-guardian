/* Verifies that the family library contains every Minecraft word card. */
const fs = require('fs')
const path = require('path')
const cloudbase = require('@cloudbase/node-sdk')

for (const line of fs.readFileSync(path.join(process.cwd(), '.env.resource-import.local'), 'utf8').split(/\r?\n/)) {
  const matched = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
  if (matched) process.env[matched[1]] = matched[2].replace(/^['"]|['"]$/g, '')
}

const app = cloudbase.init({ env: process.env.TCB_ENV_ID, secretId: process.env.TCB_SECRET_ID, secretKey: process.env.TCB_SECRET_KEY })
const db = app.database()
const getAll = async query => {
  const values = []
  for (let skip = 0; ; skip += 100) {
    const page = (await query.skip(skip).limit(100).get()).data || []
    values.push(...page)
    if (page.length < 100) return values
  }
}

async function main() {
  const families = await db.collection('families').limit(2).get()
  if (!families.data || families.data.length !== 1) throw new Error('当前环境不是唯一家庭，无法自动验证导入目标')
  const familyId = families.data[0]._id
  const records = await getAll(db.collection('learningResources').where({ familyId, libraryId: 'english', enabled: true }))
  const cards = records.filter(item => /^minecraft-(food|ore|redstone|animal|monster)$/.test(String(item.category || '')) || item.category === 'block')
  const units = new Set(cards.map(item => Number(item.unit)).filter(Number.isFinite))
  const missing = Array.from({ length: 160 }, (_, index) => index + 1).filter(unit => !units.has(unit))
  const withoutImage = cards.filter(item => !item.image).map(item => item.title)
  console.log(`Minecraft cards: ${cards.length}; units: ${units.size}; missing: ${missing.length}; without image: ${withoutImage.length}`)
  if (missing.length || withoutImage.length || units.size !== 160) {
    console.log(`Missing units: ${missing.join(',') || 'none'}`)
    console.log(`Cards without image: ${withoutImage.join(',') || 'none'}`)
    process.exitCode = 1
  }
}

main().catch(error => { console.error(error.message || error); process.exitCode = 1 })
