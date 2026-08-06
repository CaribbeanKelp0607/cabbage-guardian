const s = require('../../utils/store')

const weekNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const todayKey = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
const parseKey = key => {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}
const labelFor = key => {
  const date = parseKey(key)
  return `${date.getUTCMonth() + 1}月${date.getUTCDate()}日 ${dayNames[date.getUTCDay()]}`
}
const formatKey = date => date.toISOString().slice(0, 10)
const shiftDate = (key, days) => {
  const date = parseKey(key)
  date.setUTCDate(date.getUTCDate() + days)
  return formatKey(date)
}
const weekStart = key => {
  const date = parseKey(key)
  const offset = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - offset)
  return formatKey(date)
}
const calendarFor = selectedDate => {
  const today = todayKey()
  const start = weekStart(selectedDate)
  const currentStart = weekStart(today)
  const days = weekNames.map((week, index) => {
    const date = shiftDate(start, index)
    return {
      date,
      week,
      day: parseKey(date).getUTCDate(),
      selected: date === selectedDate,
      today: date === today,
      future: date > today
    }
  })
  return { days, canNextWeek: start < currentStart }
}
const message = e => (e && e.message) || (e && e.errMsg) || '操作失败'

Page({
  data: {
    ready: false,
    selectedDate: '',
    calendarDays: [],
    canNextWeek: false,
    selectedIsToday: true,
    periodWord: '今日',
    historyUnavailable: false,
    submittingId: '',
    editingHistoryId: '',
    editTitle: '',
    editDetail: '',
    savingHistoryTask: false,
    deletingHistoryId: '',
    detailVisible: false,
    detailTask: {}
  },
  onLoad() {
    this.setData({ selectedDate: todayKey() })
  },
  onShow() {
    this.load(this.data.selectedDate || todayKey())
  },
  load(date) {
    const calendar = calendarFor(date)
    const selectedIsToday = date === todayKey()
    this.setData({
      ready: false,
      selectedDate: date,
      calendarDays: calendar.days,
      canNextWeek: calendar.canNextWeek,
      selectedIsToday,
      periodWord: selectedIsToday ? '今日' : '当日',
      historyUnavailable: false,
      editingHistoryId: '',
      editTitle: '',
      editDetail: ''
    })
    s.get(date).then(x => {
      if (x.date !== date) {
        const dateLabel = labelFor(date)
        this.setData({
          ...x,
          date,
          dateLabel,
          tasks: [],
          completedTasks: 0,
          totalTasks: 0,
          earnedToday: 0,
          progressPercent: 0,
          welcomeText: `查看 ${dateLabel} 的打卡记录`,
          historyUnavailable: true,
          ready: true,
          submittingId: '',
        })
        wx.showToast({ title: '看板云函数未更新', icon: 'none' })
        return
      }
      const tasks = (x.tasks || []).map(task => ({ ...task, id: task.id || task._id }))
      const completedTasks = x.completedTasks == null
        ? tasks.filter(task => task.status === 'done').length
        : x.completedTasks
      const totalTasks = x.totalTasks == null ? tasks.length : x.totalTasks
      const earnedToday = x.earnedToday == null ? completedTasks : x.earnedToday
      const progressPercent = totalTasks ? Math.round(completedTasks * 100 / totalTasks) : 0
      const welcomeText = selectedIsToday
        ? (x.role === 'child' ? '今天也要认真完成任务哦' : '查看孩子今天的打卡情况')
        : `查看 ${x.dateLabel} 的打卡记录`
      this.setData({
        ...x,
        tasks,
        completedTasks,
        totalTasks,
        earnedToday,
        progressPercent,
        welcomeText,
        historyUnavailable: false,
        ready: true,
        submittingId: '',
      })
    }).catch(e => {
      this.setData({ ready: false, submittingId: '' })
      wx.showToast({ title: message(e), icon: 'none' })
    })
  },
  selectDate(e) {
    const date = e.currentTarget.dataset.date
    if (!date || date > todayKey() || date === this.data.selectedDate) return
    this.load(date)
  },
  changeWeek(e) {
    const delta = Number(e.currentTarget.dataset.delta)
    if (delta > 0 && !this.data.canNextWeek) return
    let date = shiftDate(this.data.selectedDate, delta * 7)
    if (date > todayKey()) date = todayKey()
    this.load(date)
  },
  showTaskDetail(e) {
    const id = e.currentTarget.dataset.id
    const task = this.data.tasks.find(item => item.id === id)
    if (!task) return
    this.setData({ detailVisible: true, detailTask: task })
  },
  closeTaskDetail() {
    this.setData({ detailVisible: false, detailTask: {} })
  },
  editHistoryTask(e) {
    const id = e.currentTarget.dataset.id
    const task = this.data.tasks.find(item => item.id === id)
    if (!task || task.status !== 'todo') return
    this.setData({
      editingHistoryId: id,
      editTitle: task.title,
      editDetail: task.detail || ''
    })
  },
  historyInput(e) {
    this.setData({ [e.currentTarget.dataset.key]: e.detail.value })
  },
  cancelHistoryEdit() {
    if (this.data.savingHistoryTask) return
    this.setData({ editingHistoryId: '', editTitle: '', editDetail: '' })
  },
  saveHistoryEdit() {
    if (this.data.savingHistoryTask) return
    const title = this.data.editTitle.trim()
    const detail = this.data.editDetail.trim() || '请认真完成'
    if (!title) return wx.showToast({ title: '请填写任务名称', icon: 'none' })
    this.setData({ savingHistoryTask: true })
    s.updateTask(this.data.editingHistoryId, { title, detail }).then(() => {
      wx.showToast({ title: '修改成功' })
      this.setData({ savingHistoryTask: false, editingHistoryId: '', editTitle: '', editDetail: '' })
      this.load(this.data.selectedDate)
    }).catch(e => {
      this.setData({ savingHistoryTask: false })
      wx.showToast({ title: message(e), icon: 'none' })
    })
  },
  deleteHistoryTask(e) {
    const id = e.currentTarget.dataset.id
    const task = this.data.tasks.find(item => item.id === id)
    if (!task || task.status !== 'todo' || this.data.deletingHistoryId) return
    wx.showModal({
      title: '删除历史任务',
      content: `确定删除“${task.title}”吗？`,
      confirmColor: '#c4584b',
      success: result => {
        if (!result.confirm) return
        this.setData({ deletingHistoryId: id })
        s.deleteTask(id).then(() => {
          wx.showToast({ title: '已删除' })
          this.setData({ deletingHistoryId: '' })
          this.load(this.data.selectedDate)
        }).catch(e => {
          this.setData({ deletingHistoryId: '' })
          wx.showToast({ title: message(e), icon: 'none' })
        })
      }
    })
  },
  noop() {},
  submit(e) {
    const id = e.currentTarget.dataset.id
    if (!id || this.data.submittingId) return
    this.setData({ submittingId: id })
    s.submit(id).then(result => {
      const title = result && result.duplicate ? '任务已经完成' : '打卡成功，白菜 +1'
      wx.showToast({ title, icon: 'none' })
      this.load(this.data.selectedDate)
    }).catch(e => {
      this.setData({ submittingId: '' })
      wx.showToast({ title: message(e), icon: 'none' })
    })
  }
})
