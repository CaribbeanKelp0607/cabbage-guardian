const s=require('../../utils/store');Page({data:{},onShow(){s.get().then(x=>this.setData({cabbages:x.cabbages,streak:x.streak,items:Array.from({length:Math.min(x.cabbages,24)})}))}})

