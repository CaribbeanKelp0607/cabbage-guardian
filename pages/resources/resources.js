const s = require('../../utils/store')

const message = e => (e && e.message) || (e && e.errMsg) || '操作失败'

Page({
  data: {
    ready: false,
    initializing: false,
    creatingType: '',
    role: '',
    resources: [],
    resourceError: false,
    selectedResource: {},
    resourceVisible: false,
    templates: ['朗读', '背诵', '默写']
  },
  onShow() {
    this.load()
  },
  load() {
    s.get().then(dashboard => {
      this.setData({
        role: dashboard.role,
        ready: false,
        resourceError: false
      })
      return s.getResources()
    }).then(result => {
      this.setData({
        resources: (result.resources || []).map(resource => ({ ...resource, preview: resource.content.replace(/\n/g, ' / ') })),
        templates: result.templates || ['朗读', '背诵', '默写'],
        ready: true,
        initializing: false,
        resourceError: false
      })
    }).catch(e => {
      this.setData({ ready: true, initializing: false })
      if (this.data.role) {
        this.setData({ resources: [], resourceError: true })
        wx.showToast({ title: '资源查询服务未部署', icon: 'none' })
      } else {
        wx.showToast({ title: message(e), icon: 'none' })
      }
    })
  },
  initResources() {
    if (this.data.initializing) return
    this.setData({ initializing: true })
    s.seedResources().then(result => {
      wx.showToast({ title: `已载入 ${result.count} 首古诗` })
      this.load()
    }).catch(e => {
      this.setData({ initializing: false })
      wx.showToast({ title: message(e), icon: 'none' })
    })
  },
  openResource(e) {
    const id = e.currentTarget.dataset.id
    const resource = this.data.resources.find(item => item._id === id || item.id === id)
    if (!resource) return
    this.setData({ selectedResource: resource, resourceVisible: true })
  },
  closeResource() {
    if (this.data.creatingType) return
    this.setData({ resourceVisible: false, selectedResource: {} })
  },
  stop() {},
  createTask(e) {
    const taskType = e.currentTarget.dataset.type
    const resource = this.data.selectedResource
    if (!resource || !taskType || this.data.creatingType) return
    this.setData({ creatingType: taskType })
    const requestId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)
    s.add({ resourceId: resource._id || resource.id, taskType, requestId }).then(result => {
      wx.showToast({ title: result.duplicate ? '今天已创建该任务' : '已加入今日任务', icon: 'none' })
      this.setData({ creatingType: '', resourceVisible: false, selectedResource: {} })
    }).catch(e => {
      this.setData({ creatingType: '' })
      wx.showToast({ title: message(e), icon: 'none' })
    })
  }
})
