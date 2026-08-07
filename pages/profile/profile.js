const store = require('../../utils/store')

Page({
  data: { joined: false, role: 'child' },
  onShow() {
    store.get().then(data => this.setData({ ...data, joined: true })).catch(() => this.setData({ joined: false }))
  },
  pick(e) {
    this.setData({ role: e.currentTarget.dataset.r })
  },
  confirmRole() {
    store.selectRole(this.data.role).then(() => {
      getApp().globalData.resourceCache = {}
      wx.showToast({ title: '角色已确认' })
      this.onShow()
    }).catch(error => wx.showToast({ title: error.message || '确认失败', icon: 'none' }))
  }
})
