const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const TYPES = ['corn', 'carrot', 'tomato', 'watermelon', 'cabbage', 'potato']
const EMPTY = () => TYPES.reduce((result, type) => ({ ...result, [type]: 0 }), {})
const normalize = value => TYPES.reduce((result, type) => ({ ...result, [type]: Math.max(0, Number(value && value[type]) || 0) }), {})
const totalOf = vegetables => TYPES.reduce((sum, type) => sum + vegetables[type], 0)

exports.main = async ({ action = 'get', type = '' } = {}) => {
  const { OPENID } = cloud.getWXContext()
  const familyResult = await db.collection('families').where({ members: _.elemMatch({ openid: OPENID }) }).limit(1).get()
  if (!familyResult.data.length) throw new Error('未加入家庭')
  const familyId = familyResult.data[0]._id

  return db.runTransaction(async tx => {
    const family = (await tx.collection('families').doc(familyId).get()).data
    const member = family.members.find(item => item.openid === OPENID)
    const needsReset = family.gardenVersion !== 2
    const vegetables = needsReset ? EMPTY() : normalize(family.vegetables)
    const pendingPlants = needsReset ? 0 : Math.max(0, Number(family.pendingPlants) || 0)

    if (action === 'get') {
      if (needsReset) {
        await tx.collection('families').doc(familyId).update({
          data: { gardenVersion: 2, vegetables, pendingPlants: 0, cabbages: 0, gardenResetAt: db.serverDate() }
        })
      }
      return { ok: true, role: member.role, vegetables, pendingPlants, total: totalOf(vegetables) }
    }

    if (action !== 'plant' || !TYPES.includes(type)) throw new Error('蔬菜类型无效')
    if (!member || member.role !== 'child') throw new Error('只有孩子可以选择种植蔬菜')
    if (pendingPlants < 1) throw new Error('还没有可种植的蔬菜奖励')

    vegetables[type] += 1
    const total = totalOf(vegetables)
    await tx.collection('families').doc(familyId).update({
      data: { gardenVersion: 2, vegetables, pendingPlants: pendingPlants - 1, cabbages: total, gardenUpdatedAt: db.serverDate() }
    })
    await tx.collection('events').add({
      data: { familyId, type: 'plant', vegetableType: type, createdAt: db.serverDate() }
    })
    return { ok: true, role: member.role, vegetables, pendingPlants: pendingPlants - 1, total }
  })
}
