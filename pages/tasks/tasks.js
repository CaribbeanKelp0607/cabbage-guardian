const s = require('../../utils/store')

const message = e => (e && e.message) || (e && e.errMsg) || '操作失败'
const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const dateLabel = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return '请选择日期'
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return `${year}年${month}月${day}日 ${weekDays[date.getUTCDay()]}`
}

Page({
  data: {
    title: '',
    detail: '',
    saving: false,
    deletingId: '',
    editingId: '',
    today: '',
    taskDate: '',
    taskDateLabel: '请选择日期',
    tasks: [],
    role: '',
    detailVisible: false,
    detailTask: {}
  },
  onShow() {
    this.load()
  },
  load() {
    s.get().then(x => {
      const app = getApp()
      const scheduledDate = app.globalData.scheduledTaskDate
      const taskDate = /^\d{4}-\d{2}-\d{2}$/.test(scheduledDate) && scheduledDate >= x.date
        ? scheduledDate
        : x.date
      app.globalData.scheduledTaskDate = taskDate
      this.setData({
        ...x,
        today: x.date,
        taskDate,
        taskDateLabel: dateLabel(taskDate),
        tasks: (x.tasks || []).map(task => ({ ...task, id: task.id || task._id }))
      })
    }).catch(e => {
      this.setData({ role: '' })
      wx.showToast({ title: message(e), icon: 'none' })
    })
  },
  i(e) {
    this.setData({ [e.currentTarget.dataset.k]: e.detail.value })
  },
  setTaskDate(e) {
    getApp().globalData.scheduledTaskDate = e.detail.value
    this.setData({ taskDate: e.detail.value, taskDateLabel: dateLabel(e.detail.value) })
  },
  save() {
    if (this.data.saving) return
    const title = this.data.title.trim()
    const detail = this.data.detail.trim() || '请认真完成'
    if (!title) return wx.showToast({ title: '请填写作业名称', icon: 'none' })
    this.setData({ saving: true })
    const requestId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)
    const request = this.data.editingId
      ? s.updateTask(this.data.editingId, { title, detail })
      : s.add({ title, detail, requestId, date: this.data.taskDate })
    request.then(x => {
      wx.showToast({ title: x && x.duplicate ? '任务已存在' : this.data.editingId ? '修改成功' : '已布置' })
      this.setData({ title: '', detail: '', editingId: '', saving: false })
      this.load()
    }).catch(e => {
      this.setData({ saving: false })
      wx.showToast({ title: message(e), icon: 'none' })
    })
  },
  edit(e) {
    const id = e.currentTarget.dataset.id
    const task = this.data.tasks.find(item => item.id === id)
    if (!task || task.status !== 'todo') return
    this.setData({ editingId: id, title: task.title, detail: task.detail || '' })
  },
  cancelEdit() {
    this.setData({ editingId: '', title: '', detail: '' })
  },
  goResources(e) {
    getApp().globalData.scheduledTaskDate = this.data.taskDate
    getApp().globalData.resourceSubject = e.currentTarget.dataset.subject || 'chinese'
    wx.switchTab({ url: '/pages/resources/resources' })
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
  remove(e) {
    const id = e.currentTarget.dataset.id
    const task = this.data.tasks.find(item => item.id === id)
    if (!task || task.status !== 'todo' || this.data.deletingId) return
    wx.showModal({
      title: '删除任务',
      content: `确定删除“${task.title}”吗？`,
      confirmColor: '#c4584b',
      success: result => {
        if (!result.confirm) return
        this.setData({ deletingId: id })
        s.deleteTask(id).then(() => {
          wx.showToast({ title: '已删除' })
          if (this.data.editingId === id) this.cancelEdit()
          this.setData({ deletingId: '' })
          this.load()
        }).catch(e => {
          this.setData({ deletingId: '' })
          wx.showToast({ title: message(e), icon: 'none' })
        })
      }
    })
  },
  goHome() {
    wx.switchTab({ url: '/pages/home/home' })
  }
})
