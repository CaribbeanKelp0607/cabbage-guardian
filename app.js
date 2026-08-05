App({
  globalData: {
    env: 'cloud1-d9gmpplqy199da016',
    family: {
      role: 'child',
      cabbages: 6,
      streak: 3,
      tasks: [
        { id: 'read', title: '阅读 20 分钟', detail: '读完今天的课外书', status: 'todo' },
        { id: 'math', title: '数学口算 20 题', detail: '完成后检查一遍', status: 'submitted' },
        { id: 'eng', title: '英语单词 10 个', detail: '朗读并记住', status: 'done' }
      ]
    }
  },
  onLaunch() {
    if (this.globalData.env && wx.cloud) {
      wx.cloud.init({ env: this.globalData.env, traceUser: true })
    }
  }
})
