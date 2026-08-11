const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async ({ taskId, fileID } = {}) => {
  const { OPENID } = cloud.getWXContext()
  if (!taskId || !String(fileID || '').startsWith('cloud://')) throw new Error('凭证参数无效')

  const task = (await db.collection('dailyTasks').doc(taskId).get()).data
  const family = (await db.collection('families').doc(task.familyId).get()).data
  if (!family.members.some(member => member.openid === OPENID)) throw new Error('无权查看该任务凭证')

  const evidences = Array.isArray(task.evidences) ? task.evidences : []
  if (!evidences.some(item => item && item.fileID === fileID)) throw new Error('凭证不存在')

  const result = await cloud.getTempFileURL({ fileList: [fileID] })
  const file = result && result.fileList && result.fileList[0]
  if (!file || !file.tempFileURL) {
    const error = new Error((file && (file.errMsg || file.errCode)) || '云端文件地址获取失败')
    error.errCode = file && file.errCode
    throw error
  }
  return { fileURL: file.tempFileURL }
}
