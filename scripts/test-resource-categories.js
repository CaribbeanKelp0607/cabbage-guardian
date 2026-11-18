const assert = require('assert')
const Module = require('module')
const originalLoad = Module._load
const themes = ['block', 'minecraft-food', 'minecraft-ore', 'minecraft-redstone', 'minecraft-animal', 'minecraft-monster']
const records = Array.from({ length: 160 }, (_, i) => ({ _id: `card-${i}`, familyId: 'family', libraryId: 'english', subject: 'english', category: i < 60 ? 'block' : themes[1 + Math.floor((i - 60) / 20)], title: i === 97 || i === 101 ? 'Redstone Dust' : `Card ${i}`, unit: i + 1, enabled: true }))
records.push({ _id: 'other', familyId: 'family', libraryId: 'english', subject: 'english', category: 'joinin', title: 'Other', enabled: true })
const cloud = {
  init() {}, DYNAMIC_CURRENT_ENV: 'test', getWXContext: () => ({ OPENID: 'user' }),
  database: () => ({ command: { elemMatch: x => x }, collection: name => ({ where: () => {
    let offset = 0
    return { skip(n) { offset = n; return this }, limit() { return this }, async get() { return { data: name === 'families' ? [{ _id: 'family', members: [{ openid: 'user' }] }] : records.slice(offset, offset + 100) } } }
  } }) })
}
Module._load = function (name, ...args) { return name === 'wx-server-sdk' ? cloud : originalLoad.call(this, name, ...args) }
const { main } = require('../cloudfunctions/getLearningResources/index')
main({ libraryId: 'english' }).then(result => {
  assert.strictEqual(result.resources.filter(item => item.category === 'block').length, 160)
  assert.strictEqual(result.resources.filter(item => item.title === 'Redstone Dust').length, 2)
  assert(result.resources.some(item => item.category === 'joinin'))
  assert(!result.categories.some(item => themes.slice(1).includes(item.id)))
  console.log('Category grouping verified: 160 cards and other English resources retained')
}).catch(error => { console.error(error); process.exitCode = 1 })
