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
    canCheckin: { type: Boolean, value: true },
    uploadingTaskId: { type: String, value: '' },
    recordingTaskId: { type: String, value: '' }
  },
  data: {
    dateText: '未记录',
    statusText: '待打卡',
    statusHint: '孩子完成后可提交打卡',
    playingFileId: '',
    resolvingFileId: ''
  },
  lifetimes: {
    detached() {
      this.stopAudio()
    }
  },
  observers: {
    task(task) {
      this.stopAudio()
      const status = task && task.status
      const map = {
        todo: ['待打卡', '上传图片、录音或视频后可完成打卡'],
        submitted: ['待打卡', '上传凭证后可完成打卡'],
        done: ['已完成', '已上传打卡凭证，可选择种下一颗蔬菜']
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
    destroyAudio() {
      if (this._audio) {
        const audio = this._audio
        this._audio = null
        audio.stop()
        audio.destroy()
      }
    },
    stopAudio() {
      this._audioRequestId = (this._audioRequestId || 0) + 1
      this.destroyAudio()
      if (this.data.playingFileId || this.data.resolvingFileId) {
        this.setData({ playingFileId: '', resolvingFileId: '' })
      }
    },
    playAudio(e) {
      const fileID = e.currentTarget.dataset.fileId
      if (!fileID) return
      if (this.data.playingFileId === fileID || this.data.resolvingFileId === fileID) {
        this.stopAudio()
        return
      }

      this.stopAudio()
      const requestId = this._audioRequestId
      this.setData({ resolvingFileId: fileID })
      wx.cloud.getTempFileURL({ fileList: [fileID] }).then(result => {
        if (this._audioRequestId !== requestId) return
        const file = result.fileList && result.fileList[0]
        if (!file || !file.tempFileURL) throw new Error('录音文件地址获取失败')
        const audio = wx.createInnerAudioContext()
        this._audio = audio
        audio.src = file.tempFileURL
        audio.onPlay(() => this.setData({ playingFileId: fileID, resolvingFileId: '' }))
        audio.onEnded(() => this.stopAudio())
        audio.onError(() => {
          this.stopAudio()
          wx.showToast({ title: '录音播放失败，请重试', icon: 'none' })
        })
        audio.play()
      }).catch(error => {
        if (this._audioRequestId !== requestId) return
        this.setData({ playingFileId: '', resolvingFileId: '' })
        wx.showToast({ title: error.message || '录音文件加载失败', icon: 'none' })
      })
    },
    close() {
      this.stopAudio()
      this.triggerEvent('close')
    },
    stop() {}
  }
})
