# 云函数清单

部署时创建：`bootstrapFamily`、`getDashboard`、`getLearningResources`、`seedTaskResources`、`createTask`、`manageTask`、`manageGarden`、`submitCheckin`、`confirmCheckin`、`manageMember`、`settleDay`。

本次更新后需要重新上传部署 `bootstrapFamily`、`getDashboard`、`submitCheckin` 和 `settleDay`，并首次上传 `manageGarden`。第一次进入菜地时会初始化新版菜地并清空旧蔬菜；以后孩子每完成一次打卡，会获得一次待种植奖励，可选择玉米、胡萝卜、番茄、西瓜、白菜或土豆。`settleDay` 每天 23:00 执行：当天仍有未完成任务时，从菜地现有蔬菜中随机偷走一颗，并以家庭和日期为唯一键避免重复执行。

儿童打卡需要先上传至少一项图片、录音或视频凭证。文件存储在云开发的默认云存储中；请保持该环境的云存储服务已启用。
