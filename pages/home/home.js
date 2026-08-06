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
    uploadingTaskId: '',
    recordingTaskId: '',
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
    this._draftEvidences = {}
    this.recorder = wx.getRecorderManager && wx.getRecorderManager()
    if (this.recorder) {
      this.recorder.onStop(result => {
        const taskId = this.data.recordingTaskId
        this.setData({ recordingTaskId: '' })
        if (taskId && result.tempFilePath) this.uploadEvidence(taskId, 'audio', result.tempFilePath)
      })
      this.recorder.onError(() => {
        this.setData({ recordingTaskId: '' })
        wx.showToast({ title: '录音失败，请检查麦克风权限', icon: 'none' })
      })
    }
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
      const tasks = this.decorateTasks((x.tasks || []).map(task => ({ ...task, id: task.id || task._id })))
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
  decorateTasks(tasks) {
    return tasks.map(task => {
      const draftEvidence = (this._draftEvidences && this._draftEvidences[task.id]) || []
      const names = { image: '图片', audio: '录音', video: '视频' }
      return {
        ...task,
        draftEvidence,
        hasDraftEvidence: draftEvidence.length > 0,
        draftEvidenceText: draftEvidence.length ? `已上传：${draftEvidence.map(item => names[item.type]).join('、')}` : '请至少上传一种打卡凭证'
      }
    })
  },
  saveDraftEvidence(taskId, evidence) {
    const current = (this._draftEvidences && this._draftEvidences[taskId]) || []
    this._draftEvidences = { ...(this._draftEvidences || {}), [taskId]: current.concat(evidence).slice(0, 3) }
    const tasks = this.decorateTasks(this.data.tasks)
    const detailTask = this.data.detailTask && this.data.detailTask.id === taskId
      ? tasks.find(item => item.id === taskId)
      : this.data.detailTask
    this.setData({ tasks, detailTask })
  },
  chooseImage(e) {
    const taskId = e.detail.id || e.currentTarget.dataset.id
    wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'] }).then(result => {
      const file = result.tempFiles && result.tempFiles[0]
      if (file) this.uploadEvidence(taskId, 'image', file.tempFilePath)
    }).catch(() => {})
  },
  chooseVideo(e) {
    const taskId = e.detail.id || e.currentTarget.dataset.id
    wx.chooseVideo({ sourceType: ['album', 'camera'], compressed: true, maxDuration: 60, success: result => this.uploadEvidence(taskId, 'video', result.tempFilePath) })
  },
  startRecording(e) {
    const taskId = e.detail.id || e.currentTarget.dataset.id
    if (!this.recorder || this.data.recordingTaskId) return
    this.setData({ recordingTaskId: taskId })
    this.recorder.start({ format: 'mp3', duration: 60000 })
  },
  stopRecording() {
    if (this.recorder && this.data.recordingTaskId) this.recorder.stop()
  },
  uploadEvidence(taskId, type, filePath) {
    if (!taskId || !filePath || this.data.uploadingTaskId) return
    this.setData({ uploadingTaskId: taskId })
    const suffix = (filePath.match(/\.[a-zA-Z0-9]+$/) || ['.bin'])[0]
    const cloudPath = `checkins/${taskId}/${Date.now()}-${type}${suffix}`
    wx.cloud.uploadFile({ cloudPath, filePath }).then(result => {
      this.saveDraftEvidence(taskId, { type, fileID: result.fileID })
      this.setData({ uploadingTaskId: '' })
      this.finishCheckin(taskId)
    }).catch(() => {
      this.setData({ uploadingTaskId: '' })
      wx.showToast({ title: '上传失败，请重试', icon: 'none' })
    })
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
    const id = (e.detail && e.detail.id) || (e.currentTarget && e.currentTarget.dataset.id)
    this.finishCheckin(id)
  },
  finishCheckin(id) {
    if (!id || this.data.submittingId) return
    const evidences = (this._draftEvidences && this._draftEvidences[id]) || []
    if (!evidences.length) return wx.showToast({ title: '请先上传图片、录音或视频', icon: 'none' })
    this.setData({ submittingId: id })
    s.submit(id, evidences).then(result => {
      const title = result && result.duplicate ? '任务已经完成' : '打卡成功，白菜 +1'
      wx.showToast({ title, icon: 'none' })
      if (this._draftEvidences) delete this._draftEvidences[id]
      this.setData({ detailVisible: false, detailTask: {} })
      this.load(this.data.selectedDate)
    }).catch(e => {
      this.setData({ submittingId: '' })
      wx.showToast({ title: message(e), icon: 'none' })
    })
  }
})
