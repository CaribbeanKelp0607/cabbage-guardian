const store = require('../../utils/store')

const vegetableDefinitions = [
  { type: 'corn', name: '玉米', emoji: '🌽' },
  { type: 'carrot', name: '胡萝卜', emoji: '🥕' },
  { type: 'tomato', name: '番茄', emoji: '🍅' },
  { type: 'watermelon', name: '西瓜', emoji: '🍉' },
  { type: 'cabbage', name: '白菜', emoji: '🥬' },
  { type: 'potato', name: '土豆', emoji: '🥔' }
]
const bearMessages = ['盯上菜啦', '闻到香菜啦', '伸爪准备偷', '找找哪颗菜']

const getErrorMessage = error =>
  (error && error.message) || (error && error.errMsg) || '操作失败'

Page({
  data: {
    ready: false,
    planting: false,
    role: '',
    total: 0,
    pendingPlants: 0,
    bearPositionStyle: '',
    bearBodyStyle: '',
    bearMessage: '巡逻找菜中',
    plots: vegetableDefinitions.map(item => ({ ...item, count: 0, items: [] }))
  },

  onShow() {
    this.loadGarden()
    this.startBearPatrol()
  },

  onHide() {
    this.stopBearPatrol()
  },

  onUnload() {
    this.stopBearPatrol()
  },

  startBearPatrol() {
    this.moveBear()
    this.stopBearPatrol()
    this._bearTimer = setInterval(() => this.moveBear(), 3600)
  },

  stopBearPatrol() {
    if (this._bearTimer) {
      clearInterval(this._bearTimer)
      this._bearTimer = null
    }
  },

  moveBear() {
    const left = 9 + Math.floor(Math.random() * 72)
    const bottom = 26 + Math.floor(Math.random() * 10)
    const facing = Math.random() > 0.5 ? 1 : -1
    const duration = 2.4 + Math.random() * 1.2
    const bearMessage = this.data.total > 0
      ? bearMessages[Math.floor(Math.random() * bearMessages.length)]
      : '等着长菜呢'
    this.setData({
      bearMessage,
      bearPositionStyle: `position:absolute;z-index:6;left:${left}%;bottom:${bottom}%;transition:left ${duration}s ease-in-out,bottom ${duration}s ease-in-out;pointer-events:none;`,
      bearBodyStyle: `transform:scaleX(${facing});transition:transform .45s ease;`
    })
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
      this.moveBear()
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
