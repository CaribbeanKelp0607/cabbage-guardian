const store = require('../../utils/store')

const vegetableDefinitions = [
  { type: 'corn', name: '玉米', emoji: '🌽' },
  { type: 'carrot', name: '胡萝卜', emoji: '🥕' },
  { type: 'tomato', name: '番茄', emoji: '🍅' },
  { type: 'watermelon', name: '西瓜', emoji: '🍉' },
  { type: 'cabbage', name: '白菜', emoji: '🥬' },
  { type: 'potato', name: '土豆', emoji: '🥔' }
]

const getErrorMessage = error =>
  (error && error.message) || (error && error.errMsg) || '操作失败'

Page({
  data: {
    ready: false,
    planting: false,
    role: '',
    total: 0,
    pendingPlants: 0,
    plots: vegetableDefinitions.map(item => ({ ...item, count: 0, items: [] }))
  },

  onShow() {
    this.loadGarden()
  },

  loadGarden() {
    store.getGarden().then(result => {
      const vegetables = result.vegetables || {}
      this.setData({
        ready: true,
        role: result.role,
        total: result.total || 0,
        pendingPlants: result.pendingPlants || 0,
        plots: vegetableDefinitions.map(item => {
          const count = Math.max(0, Number(vegetables[item.type]) || 0)
          return {
            ...item,
            count,
            items: Array.from({ length: Math.min(count, 9) })
          }
        })
      })
    }).catch(error => {
      wx.showToast({ title: getErrorMessage(error), icon: 'none' })
    })
  },

  plant(e) {
    const type = e.currentTarget.dataset.type
    if (this.data.planting || this.data.pendingPlants < 1) return

    this.setData({ planting: true })
    store.plantVegetable(type).then(() => {
      const choice = vegetableDefinitions.find(item => item.type === type)
      wx.showToast({ title: `种下${choice.name}${choice.emoji}` })
      this.setData({ planting: false })
      this.loadGarden()
    }).catch(error => {
      this.setData({ planting: false })
      wx.showToast({ title: getErrorMessage(error), icon: 'none' })
    })
  }
})
