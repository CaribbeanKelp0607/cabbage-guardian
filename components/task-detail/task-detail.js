const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const formatDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return value || '未记录'
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return `${year}年${month}月${day}日 ${dayNames[date.getUTCDay()]}`
}

const evidenceErrorMessage = error => {
  const detail = String((error && (error.errMsg || error.message)) || '').toLowerCase()
  if (/not.?found|not.?exist|fileid|file.?not.?exist|文件不存在/.test(detail)) return '文件不存在，可能已被清理'
  if (/permission|denied|unauthorized|auth|权限/.test(detail)) return '当前账号没有读取该凭证的权限'
  if (/network|timeout|网络|超时/.test(detail)) return '网络连接超时，请稍后重试'
  return '云端文件暂时无法读取，请稍后重试'
}

// 文件由云函数在确认当前用户属于任务家庭后换取临时地址。
// 这样即使云存储设置为“上传者私有读”，家长也能查看孩子上传的凭证。
const getAuthorizedEvidenceURL = (taskId, fileID) => wx.cloud.callFunction({
  name: 'getEvidenceFileURL',
  data: { taskId, fileID }
}).then(response => {
  const result = response && response.result
  if (!result || !result.fileURL) throw new Error((result && result.message) || '云端文件地址获取失败')
  return result.fileURL
})

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
    resolvingFileId: '',
    evidenceItems: [],
    pronunciationWords: []
  },
  lifetimes: {
    detached() {
      this.stopAudio()
    }
  },
  observers: {
    task(task) {
      this.stopAudio()
      this.loadEvidenceItems(task)
      const resource = task && task.resourceSnapshot
      const english = resource && (resource.libraryId === 'english' || resource.category === 'block')
      // 导入词卡的标题可能包含「015 · Bookshelf /音标/」。只读英文词名。
      const extractWord = value => {
        const text = String(value || '').trim().replace(/^\d+\s*[.·、:：)）-]?\s*/, '')
        const match = text.match(/^([A-Za-z][A-Za-z '\u2019-]*)(?=\s*[/\[（(\u4e00-\u9fff]|$)/)
        return match ? match[1].trim() : ''
      }
      const titleWord = resource && extractWord(resource.title)
      const firstLineWord = resource && extractWord(String(resource.content || '').split('\n')[0])
      const words = english ? [titleWord || firstLineWord] : []
      this.setData({ pronunciationWords: [...new Set(words.map(word => String(word || '').trim()).filter(word => /^[A-Za-z][A-Za-z '\u2019-]{0,99}$/.test(word)))] })
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
    playPronunciation(e) {
      const word = e.currentTarget.dataset.word
      if (!this.data.pronunciationWords.includes(word)) return
      const fileID = 'pronunciation:' + word
      if (this.data.playingFileId === fileID || this.data.resolvingFileId === fileID) {
        this.stopAudio()
        return
      }
      this.stopAudio()
      const requestId = this._audioRequestId
      const parts = word.trim().split(/\s+/)
      // 一次听读只进入一次加载状态，回退和切词不重置按钮。
      this.setData({ resolvingFileId: fileID })
      const play = (queue, index, canSplit = false) => {
        if (this._audioRequestId !== requestId) return
        this.destroyAudio()
        const audio = wx.createInnerAudioContext()
        this._audio = audio
        const active = () => this._audioRequestId === requestId && this._audio === audio
        audio.obeyMuteSwitch = false
        audio.onPlay(() => {
          if (active() && this.data.playingFileId !== fileID) {
            this.setData({ playingFileId: fileID, resolvingFileId: '' })
          }
        })
        audio.onEnded(() => {
          if (!active()) return
          if (index + 1 < queue.length) play(queue, index + 1)
          else this.stopAudio()
        })
        audio.onError(error => {
          if (!active()) return
          console.warn('单词读音加载失败', { word: queue[index], error })
          if (canSplit && parts.length > 1) {
            play(parts, 0)
            return
          }
          this.stopAudio()
          wx.showToast({ title: '读音加载失败，请稍后重试', icon: 'none' })
        })
        audio.src = 'https://dict.youdao.com/dictvoice?type=2&audio=' + encodeURIComponent(queue[index].toLowerCase())
        audio.play()
      }
      // 优先完整词组；只有完整音频失败时才逐词播放，最多回退一次。
      play([parts.join(' ')], 0, true)
    },
    loadEvidenceItems(task) {
      const evidences = Array.isArray(task && task.evidences) ? task.evidences.filter(item => item && item.fileID) : []
      const requestId = (this._evidenceRequestId || 0) + 1
      this._evidenceRequestId = requestId
      if (!evidences.length) {
        this.setData({ evidenceItems: [] })
        return
      }

      const resolveEvidence = item => {
        if (!item.fileID.startsWith('cloud://')) return Promise.resolve({ ...item, fileURL: item.fileID })
        return getAuthorizedEvidenceURL(task && task.id, item.fileID).then(fileURL => ({ ...item, fileURL }))
      }
      Promise.all(evidences.map(item => resolveEvidence(item).catch(error => {
        console.error('打卡凭证临时地址获取失败', {
          fileID: item.fileID,
          type: item.type,
          errCode: error && error.errCode,
          errMsg: error && (error.errMsg || error.message),
          error
        })
        return { ...item, fileURL: '', loadError: true, loadErrorMessage: evidenceErrorMessage(error) }
      }))).then(items => {
        if (this._evidenceRequestId !== requestId) return
        this.setData({ evidenceItems: items })
      })
    },
    retryEvidence() {
      this.loadEvidenceItems(this.properties.task)
    },
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
      const evidence = (this.data.evidenceItems || []).find(item => item.fileID === fileID)
      const play = url => {
        if (this._audioRequestId !== requestId) return
        if (!url) throw new Error('录音文件地址获取失败')
        const audio = wx.createInnerAudioContext()
        this._audio = audio
        audio.autoplay = false
        audio.obeyMuteSwitch = false
        audio.onCanplay(() => {
          if (this._audioRequestId === requestId) audio.play()
        })
        audio.onPlay(() => this.setData({ playingFileId: fileID, resolvingFileId: '' }))
        audio.onEnded(() => this.stopAudio())
        audio.onError(() => {
          this.stopAudio()
          wx.showToast({ title: '录音播放失败，请重试', icon: 'none' })
        })
        audio.src = url
      }
      const source = evidence && evidence.fileURL
      const resolve = source && !source.startsWith('cloud://')
        ? Promise.resolve(source)
        : getAuthorizedEvidenceURL(this.properties.task && this.properties.task.id, fileID)
      Promise.resolve(resolve).then(play).catch(error => {
        if (this._audioRequestId !== requestId) return
        this.setData({ playingFileId: '', resolvingFileId: '' })
        wx.showToast({ title: error.message || '录音文件加载失败', icon: 'none' })
      })
    },
    previewEvidenceImage(e) {
      const currentFileID = e.currentTarget.dataset.fileId
      const images = (this.data.evidenceItems || []).filter(item => item && item.type === 'image' && item.fileURL)
      if (!currentFileID || !images.length) return

      wx.showLoading({ title: '加载图片…', mask: true })
      Promise.resolve().then(() => {
        const urls = images.map(item => item.fileURL).filter(Boolean)
        const current = (images.find(item => item.fileID === currentFileID) || {}).fileURL || urls[0]
        if (!current || !urls.length) throw new Error('图片地址获取失败')
        wx.previewImage({ current, urls })
      }).catch(error => {
        wx.showToast({ title: error.message || '图片加载失败，请重试', icon: 'none' })
      }).finally(() => wx.hideLoading())
    },
    close() {
      this.stopAudio()
      this.triggerEvent('close')
    },
    stop() {}
  }
})
