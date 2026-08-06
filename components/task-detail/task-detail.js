const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const formatDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return value || '未记录'
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return `${year}年${month}月${day}日 ${dayNames[date.getUTCDay()]}`
}

Component({
  properties: {
    visible: { type: Boolean, value: false },
    task: { type: Object, value: {} },
    role: { type: String, value: '' },
    uploadingTaskId: { type: String, value: '' },
    recordingTaskId: { type: String, value: '' }
  },
  data: {
    dateText: '未记录',
    statusText: '待打卡',
    statusHint: '孩子完成后可提交打卡'
  },
  observers: {
    task(task) {
      const status = task && task.status
      const map = {
        todo: ['待打卡', '上传图片、录音或视频后可完成打卡'],
        submitted: ['待打卡', '上传凭证后可完成打卡'],
        done: ['已完成', '已上传打卡凭证并奖励一颗白菜']
      }
      const current = map[status] || ['状态未知', '请刷新任务数据']
      this.setData({
        dateText: formatDate(task && task.date),
        statusText: current[0],
        statusHint: current[1]
      })
    }
  },
  methods: {
    chooseImage() {
      this.triggerEvent('chooseimage', { id: this.properties.task.id })
    },
    chooseVideo() {
      this.triggerEvent('choosevideo', { id: this.properties.task.id })
    },
    startRecording() {
      this.triggerEvent('startrecording', { id: this.properties.task.id })
    },
    stopRecording() {
      this.triggerEvent('stoprecording')
    },
    close() {
      this.triggerEvent('close')
    },
    stop() {}
  }
})
