const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const templates = {
  '朗读': title => `朗读《${title}》至少 2 遍，注意停顿和节奏。`,
  '背诵': title => `背诵《${title}》，请家长抽查背诵情况。`,
  '默写': title => `默写《${title}》，完成后检查错别字和标点。`
}

exports.main = async ({ title, detail, requestId, resourceId, taskType } = {}) => {
  const { OPENID } = cloud.getWXContext()
  const familyResult = await db.collection('families').where({ 'members.openid': OPENID }).get()
  if (!familyResult.data.length) throw new Error('未加入家庭')
  const family = familyResult.data[0]
  const member = family.members.find(item => item.openid === OPENID)
  if (!member || !['father', 'mother'].includes(member.role)) throw new Error('只有爸爸妈妈能布置任务')

  let resourceSnapshot = null
  if (resourceId) {
    if (!templates[taskType]) throw new Error('请选择朗读、背诵或默写')
    const resource = (await db.collection('learningResources').doc(resourceId).get()).data
    if (!resource || !resource.enabled || resource.category !== 'poem') throw new Error('学习资源不可用')
    title = `${taskType}《${resource.title}》`
    detail = templates[taskType](resource.title)
    resourceSnapshot = {
      id: resourceId,
      category: resource.category,
      grade: resource.grade,
      volume: resource.volume,
      unit: resource.unit,
      title: resource.title,
      author: resource.author,
      dynasty: resource.dynasty,
      content: resource.content,
      taskType
    }
  } else {
    title = String(title || '').trim()
    detail = String(detail || '').trim() || '请认真完成'
  }
  if (!title) throw new Error('请填写作业名称')

  const date = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
  const same = await db.collection('dailyTasks').where({ familyId: family._id, date, title }).limit(1).get()
  if (same.data.length) return { ok: true, duplicate: true }

  const token = String(requestId || crypto.randomBytes(16).toString('hex'))
  const taskId = crypto.createHash('sha256').update(OPENID + ':' + token).digest('hex')
  try {
    await db.collection('dailyTasks').doc(taskId).get()
    return { ok: true, duplicate: true }
  } catch (e) {}

  await db.collection('dailyTasks').doc(taskId).set({
    data: {
      familyId: family._id,
      date,
      title,
      detail,
      requestId: token,
      resourceId: resourceId || '',
      resourceSnapshot,
      taskType: taskType || '',
      status: 'todo',
      createdAt: db.serverDate()
    }
  })
  return { ok: true, duplicate: false }
}
