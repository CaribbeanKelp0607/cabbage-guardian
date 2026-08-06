const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async ({ subject = 'chinese', grade = 3, volume = 'first', category = '' } = {}) => {
  const { OPENID } = cloud.getWXContext()
  const familyResult = await db.collection('families').where({ members: _.elemMatch({ openid: OPENID }) }).get()
  if (!familyResult.data.length) throw new Error('未加入家庭')
  const english = subject === 'english'
  const query = english ? { subject: 'english', enabled: true } : { grade: Number(grade), volume, enabled: true }
  if (category) query.category = category
  const result = await db.collection('learningResources').where(query).get()
  return {
    resources: result.data.sort((a, b) => a.unit - b.unit || a.title.localeCompare(b.title, 'zh-CN')),
    templates: english ? ['朗读', '拼读', '拼写'] : ['朗读', '背诵', '默写'],
    library: english
      ? { subject: 'english', eyebrow: '英语启蒙 · 我的世界', title: '我的世界英语单词卡', intro: '前 10 页方块类单词；查看单词、音标和例句，创建拼读或拼写打卡。' }
      : { subject: 'chinese', eyebrow: '统编版 · 三年级上册', title: '语文必背资源库', intro: '按内容选择资源查看全文；爸爸妈妈可将朗读、背诵或默写加入今日打卡。' },
    categories: english ? [
      { id: 'block', label: '方块类' }
    ] : [
      { id: 'poem', label: '古诗词' },
      { id: 'text', label: '课文' },
      { id: 'classical', label: '文言文' },
      { id: 'language', label: '积累' }
    ]
  }
}
