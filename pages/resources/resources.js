const s = require('../../utils/store')

const message = e => (e && e.message) || (e && e.errMsg) || '操作失败'

Page({
  data: {
    ready: false,
    initializing: false,
    creatingType: '',
    role: '',
    subject: 'chinese',
    library: { eyebrow: '统编版 · 三年级上册', title: '语文必背资源库', intro: '按内容选择资源查看全文；爸爸妈妈可将朗读、背诵或默写加入今日打卡。' },
    resources: [],
    filteredResources: [],
    activeCategory: 'all',
    categories: [{ id: 'all', label: '全部' }],
    resourceError: false,
    selectedResource: {},
    resourceVisible: false,
    templates: ['朗读', '背诵', '默写']
  },
  onShow() {
    const app = getApp()
    const subject = app.globalData.resourceSubject || this.data.subject
    app.globalData.resourceSubject = ''
    this.load(subject)
  },
  categoryLabel(id, categories) {
    const category = (categories || []).find(item => item.id === id)
    return category ? category.label : '学习资源'
  },
  filterResources() {
    const { resources, activeCategory } = this.data
    this.setData({ filteredResources: activeCategory === 'all' ? resources : resources.filter(item => item.category === activeCategory) })
  },
  load(subject = this.data.subject) {
    const activeCategory = subject === 'english' && this.data.subject !== 'english'
      ? 'joinin'
      : this.data.activeCategory
    s.get().then(dashboard => {
      this.setData({ role: dashboard.role, ready: false, resourceError: false })
      return s.getResources(subject)
    }).then(result => {
      const categories = [{ id: 'all', label: '全部' }].concat(result.categories || [])
      this.setData({
        subject,
        library: result.library || this.data.library,
        resources: (result.resources || []).map(resource => ({
          ...resource,
          categoryLabel: this.categoryLabel(resource.category, result.categories),
          icon: ({ poem: '诗', text: '文', classical: '古', language: '积', block: 'A', joinin: '英' })[resource.category] || '学',
          preview: resource.content.replace(/\n/g, ' / ')
        })),
        categories,
        activeCategory,
        templates: result.templates || ['朗读', '背诵', '默写'],
        ready: true,
        initializing: false,
        resourceError: false
      })
      this.filterResources()
    }).catch(e => {
      this.setData({ ready: true, initializing: false })
      if (this.data.role) {
        this.setData({ resources: [], filteredResources: [], resourceError: true })
        wx.showToast({ title: '资源查询服务未部署', icon: 'none' })
      } else wx.showToast({ title: message(e), icon: 'none' })
    })
  },
  setLibrary(e) {
    const subject = e.currentTarget.dataset.subject
    if (!subject || subject === this.data.subject) return
    this.setData({ subject, activeCategory: 'all', resources: [], filteredResources: [] })
    this.load(subject)
  },
  setCategory(e) {
    this.setData({ activeCategory: e.currentTarget.dataset.id })
    this.filterResources()
  },
  initResources() {
    if (this.data.initializing) return
    this.setData({ initializing: true })
    s.seedResources().then(result => {
      wx.showToast({ title: `已载入 ${result.count} 项资源` })
      this.load()
    }).catch(e => {
      this.setData({ initializing: false })
      wx.showToast({ title: message(e), icon: 'none' })
    })
  },
  openResource(e) {
    const id = e.currentTarget.dataset.id
    const resource = this.data.resources.find(item => item._id === id || item.id === id)
    if (resource) this.setData({ selectedResource: resource, resourceVisible: true })
  },
  closeResource() {
    if (!this.data.creatingType) this.setData({ resourceVisible: false, selectedResource: {} })
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
