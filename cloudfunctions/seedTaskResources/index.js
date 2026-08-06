const cloud = require('wx-server-sdk')
const resources = require('./resources')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  const familyResult = await db.collection('families').where({ 'members.openid': OPENID }).get()
  if (!familyResult.data.length) throw new Error('未加入家庭')
  const member = familyResult.data[0].members.find(item => item.openid === OPENID)
  if (!member || !['father', 'mother'].includes(member.role)) throw new Error('只有爸爸妈妈可以初始化资源库')
  for (const resource of resources) {
    await db.collection('learningResources').doc(resource.id).set({
      data: { ...resource, enabled: true, updatedAt: db.serverDate() }
    })
  }
  return { ok: true, count: resources.length }
}
