const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const TYPES = ['image', 'audio', 'video']
const EMPTY_GARDEN = { corn: 0, carrot: 0, tomato: 0, watermelon: 0, cabbage: 0, potato: 0 }
const today = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)

exports.main = async ({ taskId, evidences = [] }) => {
  const { OPENID } = cloud.getWXContext()
  if (!taskId) throw new Error('任务无效')
  const proof = Array.isArray(evidences)
    ? evidences.slice(0, 3).map(item => ({
      type: String(item && item.type || ''),
      fileID: String(item && item.fileID || '')
    })).filter(item => TYPES.includes(item.type) && item.fileID.startsWith('cloud://'))
    : []
  if (!proof.length) throw new Error('请先上传图片、录音或视频凭证')

  return db.runTransaction(async tx => {
    const task = (await tx.collection('dailyTasks').doc(taskId).get()).data
    const family = (await tx.collection('families').doc(task.familyId).get()).data
    const member = family.members.find(item => item.openid === OPENID)
    if (!member || member.role !== 'child') throw new Error('只有孩子可打卡')
    if (task.date > today()) throw new Error('未来任务请在任务日期当天再打卡')
    if (task.status === 'done') return { ok: true, duplicate: true, status: 'done', awarded: 0, pendingPlants: family.pendingPlants || 0 }
    if (!['todo', 'submitted'].includes(task.status)) throw new Error('任务状态已变化')

    await tx.collection('dailyTasks').doc(taskId).update({
      data: { status: 'done', checkedInAt: db.serverDate(), checkedInBy: OPENID, autoRewardedAt: db.serverDate(), evidences: proof }
    })

    const currentPending = family.gardenVersion === 2 ? Math.max(0, Number(family.pendingPlants) || 0) : 0
    const gardenUpdate = family.gardenVersion === 2
      ? { pendingPlants: db.command.inc(1) }
      : { gardenVersion: 2, vegetables: EMPTY_GARDEN, pendingPlants: 1, cabbages: 0, gardenResetAt: db.serverDate() }
    await tx.collection('families').doc(task.familyId).update({ data: gardenUpdate })
    await tx.collection('events').add({
      data: { familyId: task.familyId, date: task.date, type: 'reward', taskId, reward: 'vegetable', createdAt: db.serverDate() }
    })
    return { ok: true, duplicate: false, status: 'done', awarded: 1, pendingPlants: currentPending + 1 }
  })
}
