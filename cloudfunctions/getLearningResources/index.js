const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const today = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)

exports.main = async ({ subject = 'chinese', grade = 3, volume = 'first', category = '' } = {}) => {
  const { OPENID } = cloud.getWXContext()
  const english = subject === 'english'
  const query = english ? { subject: 'english', enabled: true } : { grade: Number(grade), volume, enabled: true }
  if (category) query.category = category
  const [familyResult, result] = await Promise.all([
    db.collection('families').where({ members: _.elemMatch({ openid: OPENID }) }).get(),
    db.collection('learningResources').where(query).get()
  ])
  if (!familyResult.data.length) throw new Error('未加入家庭')
  const member = familyResult.data[0].members.find(item => item.openid === OPENID)
  return {
    role: member && member.role,
    today: today(),
    resources: result.data.sort((a, b) => a.unit - b.unit || a.title.localeCompare(b.title, 'zh-CN')),
    templates: english ? ['朗读', '拼读', '拼写'] : ['朗读', '背诵', '默写'],
    library: english
      ? { subject: 'english', eyebrow: '英语学习资源', title: '英语资源库', intro: '三上单词表按 Welcome、Unit 01–06 和 Plays 分单元整理；也可学习我的世界单词卡。' }
      : { subject: 'chinese', eyebrow: '统编版 · 三年级上册', title: '语文必背资源库', intro: '按内容选择资源查看全文；爸爸妈妈可将朗读、背诵或默写加入今日打卡。' },
    categories: english ? [
      { id: 'joinin', label: '三上单词表' },
      { id: 'block', label: '我的世界单词卡' }
    ] : [
      { id: 'poem', label: '古诗词' },
      { id: 'text', label: '课文' },
      { id: 'classical', label: '文言文' },
      { id: 'language', label: '积累' }
    ]
  }
}
