const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const templates = {
  '朗读': title => `朗读《${title}》至少 2 遍，注意停顿和节奏。`,
  '背诵': title => `背诵《${title}》，请家长抽查背诵情况。`,
  '默写': title => `默写《${title}》，完成后检查错别字和标点。`,
  '拼读': title => `朗读并拼读单词 ${title} 至少 3 遍，注意发音。`,
  '拼写': title => `看中文或听读音，拼写单词 ${title} 3 次。`
}

const today = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
const validDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.toISOString().slice(0, 10) === value
}

exports.main = async ({ title, detail, requestId, resourceId, taskType, date } = {}) => {
  const { OPENID } = cloud.getWXContext()
  const familyResult = await db.collection('families').where({ 'members.openid': OPENID }).get()
  if (!familyResult.data.length) throw new Error('未加入家庭')
  const family = familyResult.data[0]
  const member = family.members.find(item => item.openid === OPENID)
  if (!member || !['father', 'mother'].includes(member.role)) throw new Error('只有爸爸妈妈能布置任务')

  let resourceSnapshot = null
  if (resourceId) {
    if (!templates[taskType]) throw new Error('请选择可用的任务类型')
    const resource = (await db.collection('learningResources').doc(resourceId).get()).data
    if (!resource || !resource.enabled) throw new Error('学习资源不可用')
    if (resource.familyId && resource.familyId !== family._id) throw new Error('无权使用其他家庭的资源')
    title = `${taskType}《${resource.title}》`
    detail = templates[taskType](resource.title)
    resourceSnapshot = {
      id: resourceId,
      category: resource.category,
      categoryLabel: resource.categoryLabel,
      libraryId: resource.libraryId || resource.subject,
      libraryLabel: resource.libraryLabel,
      grade: resource.grade,
      volume: resource.volume,
      unit: resource.unit,
      title: resource.title,
      author: resource.author,
      dynasty: resource.dynasty,
      content: resource.content,
      image: resource.image,
      taskType
    }
  } else {
    title = String(title || '').trim()
    detail = String(detail || '').trim() || '请认真完成'
  }
  if (!title) throw new Error('请填写作业名称')

  const taskDate = String(date || today())
  if (!validDate(taskDate)) throw new Error('任务日期无效')
  if (taskDate < today()) throw new Error('不能创建昨天或更早的任务')

  const same = await db.collection('dailyTasks').where({ familyId: family._id, date: taskDate, title }).limit(1).get()
  if (same.data.length) return { ok: true, duplicate: true }

  const token = String(requestId || crypto.randomBytes(16).toString('hex'))
  const taskId = crypto.createHash('sha256').update(OPENID + ':' + token).digest('hex')
  try {
    await db.collection('dailyTasks').doc(taskId).get()
    return { ok: true, duplicate: true }
  } catch (e) {}

  // 家庭文档作为事务中的共同锁，任务与累计次数一起提交。
  return db.runTransaction(async transaction => {
    const currentFamily = (await transaction.collection('families').doc(family._id).get()).data
    let existing
    try {
      existing = (await transaction.collection('dailyTasks').doc(taskId).get()).data
    } catch (error) {
      if (!/not.?exist|not.?found|不存在/i.test(String(error.errMsg || error.message || ''))) throw error
    }
    if (existing) return { ok: true, duplicate: true }
    await transaction.collection('dailyTasks').doc(taskId).set({
    data: {
      familyId: family._id,
      date: taskDate,
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
    let dispatchCount
    if (resourceId) {
      const key = crypto.createHash('sha256').update(String(resourceId)).digest('hex')
      const counts = { ...(currentFamily.resourceDispatchCounts || {}) }
      dispatchCount = Number(counts[key] || 0) + 1
      counts[key] = dispatchCount
      await transaction.collection('families').doc(family._id).update({ data: { resourceDispatchCounts: counts } })
    }
    return { ok: true, duplicate: false, ...(resourceId ? { dispatchCount } : {}) }
  })
}
