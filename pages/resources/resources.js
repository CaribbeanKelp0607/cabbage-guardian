const store = require('../../utils/store')

const CACHE_TTL = 5 * 60 * 1000
const message = error => (error && error.message) || (error && error.errMsg) || '操作失败'
const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const localToday = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
const isParent = role => role === 'father' || role === 'mother'
const dateLabel = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return '请选择日期'
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return `${year}年${month}月${day}日 ${weekDays[date.getUTCDay()]}`
}

Page({
  data: {
    ready: false,
    initializing: false,
    creatingType: '',
    role: '',
    libraryId: 'chinese',
    libraries: [],
    categoryMap: {},
    library: { eyebrow: '语文资料库', title: '语文资料库', intro: '按内容选择资源查看全文。' },
    resources: [],
    filteredResources: [],
    activeCategory: 'all',
    categories: [{ id: 'all', label: '全部' }],
    resourceError: false,
    selectedResource: {},
    resourceVisible: false,
    today: '',
    resourceTaskDate: '',
    resourceTaskDateLabel: '请选择日期',
    templates: ['朗读', '背诵', '默写'],
    uploadVisible: false,
    uploadingImage: false,
    savingResource: false,
    batchItems: [],
    uploadProgressText: '',
    uploadLibraryIndex: 0,
    uploadLibraryId: 'chinese',
    uploadLibraryLabel: '语文资料库',
    uploadCategoryIndex: 0,
    uploadCategoryId: '',
    uploadCategoryLabel: '',
    uploadCategories: [],
    uploadTitle: '',
    uploadContent: '',
    uploadImage: '',
    newLibraryLabel: '',
    newCategoryLabel: ''
  },

  onShow() {
    const app = getApp()
    const libraryId = app.globalData.resourceSubject || this.data.libraryId
    app.globalData.resourceSubject = ''
    this.load(libraryId)
  },

  categoryLabel(id, categories) {
    const category = (categories || []).find(item => item.id === id)
    return category ? category.label : '学习资源'
  },

  filterResources() {
    const { resources, activeCategory } = this.data
    this.setData({ filteredResources: activeCategory === 'all' ? resources : resources.filter(item => item.category === activeCategory) })
  },

  applyResources(result, libraryId, activeCategory) {
    const app = getApp()
    const today = result.today || localToday()
    const scheduledDate = app.globalData.scheduledTaskDate
    const resourceTaskDate = /^\d{4}-\d{2}-\d{2}$/.test(scheduledDate) && scheduledDate >= today ? scheduledDate : today
    const resourceCategories = result.categories || []
    const categories = [{ id: 'all', label: '全部' }].concat(resourceCategories)
    app.globalData.scheduledTaskDate = resourceTaskDate
    this.setData({
      role: result.role || this.data.role,
      libraryId,
      libraries: result.libraries || [],
      categoryMap: result.categoryMap || {},
      library: result.library || this.data.library,
      resources: (result.resources || []).map(resource => ({
        ...resource,
        dispatchCount: Number(resource.dispatchCount || 0),
        categoryLabel: resource.categoryLabel || this.categoryLabel(resource.category, resourceCategories),
        icon: ({ poem: '诗', text: '文', classical: '古', language: '积', block: 'A', joinin: '英' })[resource.category] || '学',
        preview: String(resource.content || '').replace(/\n/g, ' / ') || (resource.image ? '已上传图片资源' : '')
      })),
      categories,
      activeCategory: categories.some(item => item.id === activeCategory) ? activeCategory : 'all',
      today,
      resourceTaskDate,
      resourceTaskDateLabel: dateLabel(resourceTaskDate),
      templates: result.templates || ['朗读', '背诵', '默写'],
      ready: true,
      initializing: false,
      resourceError: false
    })
    this.filterResources()
  },

  load(libraryId = this.data.libraryId, preferredCategory = '') {
    const activeCategory = preferredCategory || this.data.activeCategory
    const app = getApp()
    const cacheKey = libraryId
    const cached = app.globalData.resourceCache && app.globalData.resourceCache[cacheKey]
    if (cached && cached.expiresAt > Date.now()) {
      this.applyResources(cached.result, libraryId, activeCategory)
      return
    }
    this.setData({ ready: false, resourceError: false })
    store.getResources(libraryId).then(result => {
      app.globalData.resourceCache = app.globalData.resourceCache || {}
      app.globalData.resourceCache[cacheKey] = { result, expiresAt: Date.now() + CACHE_TTL }
      this.applyResources(result, libraryId, activeCategory)
    }).catch(error => {
      this.setData({ ready: true, initializing: false, resources: [], filteredResources: [], resourceError: true })
      wx.showToast({ title: this.data.role ? '资源查询服务未部署' : message(error), icon: 'none' })
    })
  },

  setLibrary(e) {
    const libraryId = e.currentTarget.dataset.id
    if (!libraryId || libraryId === this.data.libraryId) return
    this.setData({ libraryId, activeCategory: 'all', resources: [], filteredResources: [] })
    this.load(libraryId, 'all')
  },

  setCategory(e) {
    this.setData({ activeCategory: e.currentTarget.dataset.id })
    this.filterResources()
  },

  initResources() {
    if (this.data.initializing) return
    this.setData({ initializing: true })
    store.seedResources().then(result => {
      getApp().globalData.resourceCache = {}
      wx.showToast({ title: `已载入 ${result.count} 项资源` })
      this.load()
    }).catch(error => {
      this.setData({ initializing: false })
      wx.showToast({ title: message(error), icon: 'none' })
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

  setResourceTaskDate(e) {
    getApp().globalData.scheduledTaskDate = e.detail.value
    this.setData({ resourceTaskDate: e.detail.value, resourceTaskDateLabel: dateLabel(e.detail.value) })
  },

  createTask(e) {
    const taskType = e.currentTarget.dataset.type
    const resource = this.data.selectedResource
    if (!resource || !taskType || this.data.creatingType) return
    this.setData({ creatingType: taskType })
    const requestId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)
    store.add({ resourceId: resource._id || resource.id, taskType, requestId, date: this.data.resourceTaskDate }).then(result => {
      if (!result.duplicate) {
        const resourceId = resource._id || resource.id
        const resources = this.data.resources.map(item => (item._id || item.id) === resourceId
          ? { ...item, dispatchCount: result.dispatchCount == null ? Number(item.dispatchCount || 0) + 1 : result.dispatchCount }
          : item)
        this.setData({ resources })
        this.filterResources()
      }
      // 再次打开任一资料库时从云端读取最新累计值。
      getApp().globalData.resourceCache = {}
      wx.showToast({ title: result.duplicate ? '该日期已创建该任务' : '已创建任务', icon: 'none' })
      this.setData({ creatingType: '', resourceVisible: false, selectedResource: {} })
    }).catch(error => {
      this.setData({ creatingType: '' })
      wx.showToast({ title: message(error), icon: 'none' })
    })
  },

  openUpload() {
    if (!isParent(this.data.role)) return
    const libraries = this.data.libraries || []
    const uploadLibraryIndex = Math.max(0, libraries.findIndex(item => item.id === this.data.libraryId))
    const uploadLibrary = libraries[uploadLibraryIndex] || { id: this.data.libraryId }
    const uploadCategories = (this.data.categoryMap[uploadLibrary.id] || []).slice()
    this.setData({
      uploadVisible: true,
      uploadLibraryIndex,
      uploadLibraryId: uploadLibrary.id,
      uploadLibraryLabel: uploadLibrary.label || '',
      uploadCategories,
      uploadCategoryIndex: 0,
      uploadCategoryId: uploadCategories[0] ? uploadCategories[0].id : '',
      uploadCategoryLabel: uploadCategories[0] ? uploadCategories[0].label : '',
      batchItems: [],
      uploadProgressText: '',
      uploadingImage: false,
      newLibraryLabel: '',
      newCategoryLabel: ''
    })
  },

  closeUpload() {
    if (!this.data.savingResource && !this.data.uploadingImage) this.setData({ uploadVisible: false })
  },

  changeUploadLibrary(e) {
    const uploadLibraryIndex = Number(e.detail.value)
    const library = this.data.libraries[uploadLibraryIndex]
    if (!library) return
    const uploadCategories = (this.data.categoryMap[library.id] || []).slice()
    this.setData({
      uploadLibraryIndex,
      uploadLibraryId: library.id,
      uploadLibraryLabel: library.label || '',
      uploadCategories,
      uploadCategoryIndex: 0,
      uploadCategoryId: uploadCategories[0] ? uploadCategories[0].id : '',
      uploadCategoryLabel: uploadCategories[0] ? uploadCategories[0].label : ''
    })
  },

  changeUploadCategory(e) {
    const uploadCategoryIndex = Number(e.detail.value)
    const category = this.data.uploadCategories[uploadCategoryIndex]
    if (category) this.setData({ uploadCategoryIndex, uploadCategoryId: category.id, uploadCategoryLabel: category.label || '' })
  },

  uploadInput(e) {
    this.setData({ [e.currentTarget.dataset.key]: e.detail.value })
  },

  chooseUploadImages() {
    if (this.data.uploadingImage) return
    wx.chooseMedia({ count: 9, mediaType: ['image'], sourceType: ['album', 'camera'] }).then(result => {
      const files = (result.tempFiles || []).filter(file => file && file.tempFilePath).slice(0, 9)
      if (!files.length) return
      const stamp = Date.now()
      const batchItems = files.map((file, index) => ({
        key: `${stamp}-${index}`,
        fileID: '',
        localPath: file.tempFilePath,
        title: `资源 ${String(index + 1).padStart(2, '0')}`,
        content: '',
        state: 'uploading',
        error: ''
      }))
      this.setData({ batchItems, uploadingImage: true, uploadProgressText: `正在上传 0/${files.length}` })
      return Promise.all(files.map((file, index) => {
        const suffix = (file.tempFilePath.match(/\.[a-zA-Z0-9]+$/) || ['.jpg'])[0]
        return wx.cloud.uploadFile({ cloudPath: `resource-images/${stamp}-${index}${suffix}`, filePath: file.tempFilePath })
          .then(result => ({ key: batchItems[index].key, fileID: result.fileID, error: '' }))
          .catch(() => ({ key: batchItems[index].key, fileID: '', error: '图片上传失败，请重新选择' }))
      }))
    }).then(results => {
      if (!results) return
      const batchItems = this.data.batchItems.map(item => {
        const result = results.find(value => value.key === item.key)
        return result ? { ...item, fileID: result.fileID, state: result.fileID ? 'uploaded' : 'failed', error: result.error } : item
      })
      const uploaded = batchItems.filter(item => item.fileID)
      this.setData({ batchItems: batchItems.map((item, index) => item.fileID ? { ...item, state: 'ready', title: item.title || `未命名资源 ${String(index + 1).padStart(2, '0')}` } : item), uploadingImage: false, uploadProgressText: uploaded.length ? `已上传 ${uploaded.length}/${batchItems.length}，请填写每项资源名称后保存` : '图片上传失败，请重新选择' })
    }).catch(() => this.setData({ uploadingImage: false, uploadProgressText: '' }))
  },

  editBatchTitle(e) {
    const index = Number(e.currentTarget.dataset.index)
    const batchItems = this.data.batchItems.slice()
    if (!batchItems[index]) return
    batchItems[index] = { ...batchItems[index], title: e.detail.value }
    this.setData({ batchItems })
  },

  removeBatchItem(e) {
    const index = Number(e.currentTarget.dataset.index)
    const item = this.data.batchItems[index]
    if (!item) return
    const batchItems = this.data.batchItems.filter((_, itemIndex) => itemIndex !== index)
    this.setData({ batchItems })
    if (item.fileID) wx.cloud.deleteFile({ fileList: [item.fileID] }).catch(() => {})
  },

  saveBatchResources() {
    if (this.data.savingResource) return
    const newLibraryLabel = this.data.newLibraryLabel.trim()
    const newCategoryLabel = this.data.newCategoryLabel.trim()
    const items = this.data.batchItems.filter(item => item.fileID)
    if (!items.length) return wx.showToast({ title: '请先选择图片资源', icon: 'none' })
    if (items.some(item => !String(item.title || '').trim())) return wx.showToast({ title: '请填写每项资源名称', icon: 'none' })
    if (!newLibraryLabel && !this.data.uploadLibraryId) return wx.showToast({ title: '请选择或新建一级分类', icon: 'none' })
    if (!newCategoryLabel && !this.data.uploadCategoryId) return wx.showToast({ title: '请选择或新建二级分类', icon: 'none' })
    this.setData({ savingResource: true })
    store.createResources({
      batchId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      items: items.map(item => ({ image: item.fileID, title: item.title.trim(), content: item.content })),
      libraryId: this.data.uploadLibraryId,
      libraryLabel: newLibraryLabel,
      selectedLibraryLabel: this.data.uploadLibraryLabel,
      categoryId: this.data.uploadCategoryId,
      categoryLabel: newCategoryLabel,
      selectedCategoryLabel: this.data.uploadCategoryLabel
    }).then(result => {
      getApp().globalData.resourceCache = {}
      wx.showToast({ title: `已保存 ${result.count} 项资源` })
      this.setData({ savingResource: false, uploadVisible: false, libraryId: result.libraryId, activeCategory: 'all' })
      this.load(result.libraryId, 'all')
    }).catch(error => {
      this.setData({ savingResource: false })
      wx.showToast({ title: message(error), icon: 'none' })
    })
  }
})
