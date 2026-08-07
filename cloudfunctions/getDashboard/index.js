const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const week = ['日', '一', '二', '三', '四', '五', '六']

const today = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
const previous = date => {
  const [year, month, day] = date.split('-').map(Number)
  const value = new Date(Date.UTC(year, month - 1, day - 1))
  return value.toISOString().slice(0, 10)
}
const dateInfo = value => {
  const date = value || today()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('日期无效')
  const [year, month, day] = date.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (parsed.toISOString().slice(0, 10) !== date) throw new Error('日期无效')
  return {
    date,
    dateLabel: `${month}月${day}日 周${week[parsed.getUTCDay()]}`,
    isToday: date === today(),
    isFuture: date > today()
  }
}
const calculateStreak = (records, endDate) => {
  const grouped = {}
  records.forEach(task => { (grouped[task.date] || (grouped[task.date] = [])).push(task) })
  const complete = date => grouped[date] && grouped[date].length && grouped[date].every(task => task.status === 'done')
  let cursor = complete(endDate) ? endDate : previous(endDate)
  let streak = 0
  while (complete(cursor)) {
    streak += 1
    cursor = previous(cursor)
  }
  return streak
}

exports.main = async ({ date } = {}) => {
  const { OPENID } = cloud.getWXContext()
  const familyResult = await db.collection('families').where({ members: _.elemMatch({ openid: OPENID }) }).get()
  if (!familyResult.data.length) throw new Error('未加入家庭')

  const family = familyResult.data[0]
  const member = family.members.find(item => item.openid === OPENID)
  const day = dateInfo(date)
  const taskResult = await db.collection('dailyTasks').where({ familyId: family._id, date: day.date }).get()
  const streakEndDate = day.isFuture ? today() : day.date
  const history = await db.collection('dailyTasks').where({ familyId: family._id, date: _.lte(streakEndDate) }).limit(100).get()
  const tasks = taskResult.data
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
    .map(task => ({ ...task, id: task._id }))
  const completedTasks = tasks.filter(task => task.status === 'done').length

  return {
    familyId: family._id,
    role: member.role,
    cabbages: family.gardenVersion === 2 ? (family.cabbages || 0) : 0,
    streak: calculateStreak(history.data, streakEndDate),
    date: day.date,
    dateLabel: day.dateLabel,
    isToday: day.isToday,
    isFuture: day.isFuture,
    totalTasks: tasks.length,
    completedTasks,
    earnedToday: completedTasks,
    tasks,
    isAdmin: family.ownerOpenid === OPENID,
    members: family.ownerOpenid === OPENID ? family.members : []
  }
}
