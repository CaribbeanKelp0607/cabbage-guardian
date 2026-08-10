const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const defaultLibraries = [
  { id: 'chinese', label: '语文资料库' },
  { id: 'english', label: '英语资料库' },
  { id: 'math', label: '数学资料库' }
]
const defaultCategories = {
  chinese: [
    { id: 'poem', label: '古诗词' },
    { id: 'text', label: '课文' },
    { id: 'classical', label: '文言文' },
    { id: 'language', label: '积累' }
  ],
  english: [
    { id: 'joinin', label: '三上单词表' },
    { id: 'block', label: '我的世界单词卡' }
  ],
  math: []
}
const today = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
const uniqueById = values => values.filter((item, index, list) => item && item.id && list.findIndex(other => other.id === item.id) === index)

exports.main = async ({ subject = '', libraryId = '', grade = 3, volume = 'first', category = '' } = {}) => {
  const { OPENID } = cloud.getWXContext()
  const requestedLibrary = String(libraryId || subject || 'chinese')
  const familyResult = await db.collection('families').where({ members: _.elemMatch({ openid: OPENID }) }).get()
  if (!familyResult.data.length) throw new Error('未加入家庭')
  const family = familyResult.data[0]
  const member = family.members.find(item => item.openid === OPENID)

  const seededQuery = requestedLibrary === 'english'
    ? { subject: 'english', enabled: true }
    : requestedLibrary === 'chinese'
      ? { grade: Number(grade), volume, enabled: true }
      : null
  const [familyResourcesResult, seededResult] = await Promise.all([
    db.collection('learningResources').where({ familyId: family._id, enabled: true }).limit(100).get(),
    seededQuery ? db.collection('learningResources').where(seededQuery).limit(100).get() : Promise.resolve({ data: [] })
  ])
  const familyResources = familyResourcesResult.data
  // 英语公共资源查询会同时命中家庭导入资源；家庭资源仅在后半段合并一次。
  const seededResources = seededResult.data.filter(item => !item.familyId)
  const resources = seededResources.concat(familyResources.filter(item => item.libraryId === requestedLibrary))
    .filter(item => !category || item.category === category)
    .sort((a, b) => Number(a.unit || 0) - Number(b.unit || 0) || String(a.title || '').localeCompare(String(b.title || ''), 'zh-CN'))

  const customLibraries = familyResources
    .map(item => item.libraryId && item.libraryId !== 'chinese' && item.libraryId !== 'english' && item.libraryId !== 'math'
      ? { id: item.libraryId, label: item.libraryLabel || '自定义资料库' }
      : null)
    .filter(Boolean)
  const libraries = uniqueById(defaultLibraries.concat(customLibraries))
  const dynamicCategories = familyResources
    .filter(item => item.libraryId === requestedLibrary && item.category)
    .map(item => ({ id: item.category, label: item.categoryLabel || '未分类' }))
  const categories = uniqueById((defaultCategories[requestedLibrary] || []).concat(dynamicCategories))
  const categoryMap = defaultLibraries.reduce((map, item) => {
    map[item.id] = defaultCategories[item.id] || []
    return map
  }, {})
  familyResources.forEach(item => {
    if (!item.libraryId || !item.category) return
    categoryMap[item.libraryId] = uniqueById((categoryMap[item.libraryId] || []).concat([{
      id: item.category,
      label: item.categoryLabel || '未分类'
    }]))
  })
  const library = libraries.find(item => item.id === requestedLibrary) || { id: requestedLibrary, label: '学习资料库' }
  const english = requestedLibrary === 'english'

  return {
    role: member && member.role,
    today: today(),
    resources,
    libraries,
    libraryId: requestedLibrary,
    templates: english ? ['朗读', '拼读', '拼写'] : ['朗读', '背诵', '默写'],
    library: {
      subject: requestedLibrary,
      eyebrow: library.label,
      title: library.label,
      intro: member && ['father', 'mother'].includes(member.role)
        ? '可浏览现有资源，也可上传图片或文本，并按一级、二级分类整理。'
        : '按分类浏览学习资源，完成后可在“今天”页提交打卡。'
    },
    categories,
    categoryMap
  }
}
