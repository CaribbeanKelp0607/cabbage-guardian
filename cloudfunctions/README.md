# 云函数清单

资料派发次数：重新部署 `createTask`、`getLearningResources`，并更新小程序前端。每个家庭的每项资料从本功能上线后累计成功派发次数；重复提交不加次数，删除任务不扣次数，历史任务暂不补算。计数保存在家庭文档 `resourceDispatchCounts` 中，与任务创建通过事务一起提交；公共资料不会累计其他家庭的次数。

部署时创建：`bootstrapFamily`、`getDashboard`、`getLearningResources`、`seedTaskResources`、`createTask`、`manageTask`、`manageGarden`、`submitCheckin`、`confirmCheckin`、`manageMember`、`settleDay`、`manageLearningResource`。

本次更新后需要重新上传部署 `bootstrapFamily`、`getDashboard`、`submitCheckin` 和 `settleDay`，并首次上传 `manageGarden`。第一次进入菜地时会初始化新版菜地并清空旧蔬菜；以后孩子每完成一次打卡，会获得一次待种植奖励，可选择玉米、胡萝卜、番茄、西瓜、白菜或土豆。`settleDay` 每天 23:00 执行：当天仍有未完成任务时，从菜地现有蔬菜中随机偷走一颗，并以家庭和日期为唯一键避免重复执行。

儿童打卡需要先上传至少一项图片、录音或视频凭证。文件存储在云开发的默认云存储中；请保持该环境的云存储服务已启用。

英语资源库新增或更新“三上单词表”后，需要重新部署 `getLearningResources` 和 `seedTaskResources`，然后由爸爸或妈妈在“英语资料库”点击“更新资源库”。该操作会按固定资源 ID 更新 Welcome、Unit 01–06 与 Plays，不会影响已创建的任务快照。

任务支持创建到今天或未来日期。更新此功能后请重新部署 `createTask`、`getDashboard`、`submitCheckin`；未来任务仅供查看，孩子在任务日期当天前无法打卡。
