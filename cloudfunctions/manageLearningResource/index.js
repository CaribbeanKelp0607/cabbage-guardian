const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const libraryLabels = { chinese: '语文资料库', english: '英语资料库', math: '数学资料库' }
const clean = (value, max = 80) => String(value || '').trim().slice(0, max)
const identifier = (prefix, familyId, value) => `${prefix}-${crypto.createHash('sha1').update(`${familyId}:${value}`).digest('hex').slice(0, 12)}`
const isCloudFile = value => String(value || '').startsWith('cloud://')
const isResourceImage = value => isCloudFile(value) && String(value).includes('resource-images/')

async function requireParent() {
  const { OPENID } = cloud.getWXContext()
  const familyResult = await db.collection('families').where({ 'members.openid': OPENID }).get()
  if (!familyResult.data.length) throw new Error('未加入家庭')
  const family = familyResult.data[0]
  const member = family.members.find(item => item.openid === OPENID)
  if (!member || !['father', 'mother'].includes(member.role)) throw new Error('只有爸爸妈妈可以上传资源')
  return { family, openid: OPENID }
}

function resolveCategory(familyId, input) {
  const newLibraryLabel = clean(input.libraryLabel, 30)
  const existingLibraryLabel = clean(input.selectedLibraryLabel, 30)
  const selectedLibraryId = clean(input.libraryId, 60)
  const libraryId = newLibraryLabel ? identifier('library', familyId, newLibraryLabel) : selectedLibraryId
  const libraryLabel = newLibraryLabel || existingLibraryLabel || libraryLabels[libraryId] || '学习资料库'
  if (!libraryId) throw new Error('请选择或新建一级分类')

  const newCategoryLabel = clean(input.categoryLabel, 30)
  const existingCategoryLabel = clean(input.selectedCategoryLabel, 30)
  const selectedCategoryId = clean(input.categoryId, 60)
  const categoryId = newCategoryLabel ? identifier('category', familyId, `${libraryId}:${newCategoryLabel}`) : selectedCategoryId
  const categoryLabel = newCategoryLabel || existingCategoryLabel || '未分类'
  if (!categoryId) throw new Error('请选择或新建二级分类')
  return { libraryId, libraryLabel, categoryId, categoryLabel }
}

exports.main = async (event = {}) => {
  const { action } = event
  const { family, openid } = await requireParent()
  const category = resolveCategory(family._id, event)

  if (action === 'create') {
    const title = clean(event.title)
    const content = clean(event.content, 8000)
    const image = clean(event.image, 500)
    if (!title) throw new Error('请填写资源名称')
    if (!content && !image) throw new Error('请上传图片或填写资源内容')
    if (image && !isResourceImage(image)) throw new Error('图片文件无效')
    await db.collection('learningResources').add({
      data: {
        familyId: family._id, createdBy: openid, source: 'family', ...category,
        subject: category.libraryId, title, content, image, enabled: true,
        createdAt: db.serverDate(), updatedAt: db.serverDate()
      }
    })
    return { ok: true, ...category, count: 1 }
  }

  if (action !== 'createBatch') throw new Error('不支持的资源操作')
  const items = Array.isArray(event.items) ? event.items.slice(0, 9) : []
  const batchId = clean(event.batchId, 80)
  if (!batchId || !items.length) throw new Error('请先选择图片资源')
  const createdIds = []
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index] || {}
    const image = clean(item.image, 500)
    const title = clean(item.title)
    const content = clean(item.content, 8000)
    if (!isResourceImage(image) || !title) throw new Error(`第 ${index + 1} 项资源信息不完整`)
    const id = identifier('resource', family._id, `${batchId}:${index}`)
    try {
      await db.collection('learningResources').doc(id).get()
      createdIds.push(id)
      continue
    } catch (error) {}
    await db.collection('learningResources').doc(id).set({
      data: {
        familyId: family._id, createdBy: openid, source: 'family', ...category,
        subject: category.libraryId, title, content, image,
        batchId, enabled: true,
        createdAt: db.serverDate(), updatedAt: db.serverDate()
      }
    })
    createdIds.push(id)
  }
  return { ok: true, ...category, count: createdIds.length, ids: createdIds }
}
