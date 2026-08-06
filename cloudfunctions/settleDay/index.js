const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const TYPES = ['corn', 'carrot', 'tomato', 'watermelon', 'cabbage', 'potato']
const EMPTY = () => TYPES.reduce((result, type) => ({ ...result, [type]: 0 }), {})
const normalize = value => TYPES.reduce((result, type) => ({ ...result, [type]: Math.max(0, Number(value && value[type]) || 0) }), {})
const totalOf = vegetables => TYPES.reduce((sum, type) => sum + vegetables[type], 0)

exports.main = async ({ date } = {}) => {
  const day = date || new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
  const pendingTasks = (await db.collection('dailyTasks').where({ date: day, status: db.command.neq('done') }).get()).data
  const familyIds = [...new Set(pendingTasks.map(task => task.familyId))]

  for (const familyId of familyIds) {
    const eventId = `settle_${familyId}_${day}`
    await db.runTransaction(async tx => {
      try {
        await tx.collection('events').doc(eventId).get()
        return
      } catch (error) {}

      const family = (await tx.collection('families').doc(familyId).get()).data
      const vegetables = family.gardenVersion === 2 ? normalize(family.vegetables) : EMPTY()
      const candidates = TYPES.flatMap(type => Array.from({ length: vegetables[type] }, () => type))
      const stolenType = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : ''
      if (stolenType) vegetables[stolenType] -= 1
      const total = totalOf(vegetables)

      await tx.collection('families').doc(familyId).update({
        data: { gardenVersion: 2, vegetables, cabbages: total, pendingPlants: family.gardenVersion === 2 ? Math.max(0, Number(family.pendingPlants) || 0) : 0, streak: 0 }
      })
      await tx.collection('events').doc(eventId).set({
        data: { familyId, date: day, type: 'bear', vegetableType: stolenType, stolen: Boolean(stolenType), createdAt: db.serverDate() }
      })
    })
  }
  return { date: day, settled: familyIds.length }
}
