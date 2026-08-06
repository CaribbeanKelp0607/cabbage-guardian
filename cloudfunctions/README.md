# 云函数清单

部署时创建：`bootstrapFamily`、`getDashboard`、`getLearningResources`、`seedTaskResources`、`createTask`、`manageTask`、`submitCheckin`、`confirmCheckin`、`manageMember`、`settleDay`。

本次更新后需要重新上传部署 `getDashboard`、`createTask`、`submitCheckin`、`confirmCheckin`、`settleDay`、`getLearningResources` 和 `seedTaskResources`，并首次上传 `manageTask`。资源库更新后，请以爸爸或妈妈身份再次点击“初始化资源库”；固定 ID 会覆盖资源目录，不影响已经创建的家庭任务。其中 `settleDay` 用每天 23:00 的定时触发器执行，并在服务端以家庭和日期为唯一键，保证不会重复扣除白菜。
