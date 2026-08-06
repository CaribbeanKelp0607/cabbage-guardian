const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async ({ grade = 3, volume = 'first', category = 'poem' } = {}) => {
  const { OPENID } = cloud.getWXContext()
  const familyResult = await db.collection('families').where({ members: _.elemMatch({ openid: OPENID }) }).get()
  if (!familyResult.data.length) throw new Error('未加入家庭')
  const result = await db.collection('learningResources').where({ grade: Number(grade), volume, category, enabled: true }).get()
  return {
    resources: result.data.sort((a, b) => a.unit - b.unit || a.title.localeCompare(b.title, 'zh-CN')),
    templates: ['朗读', '背诵', '默写']
  }
}
