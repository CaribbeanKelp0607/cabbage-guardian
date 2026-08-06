# 云函数清单

部署时创建：`bootstrapFamily`、`getDashboard`、`getLearningResources`、`seedTaskResources`、`createTask`、`manageTask`、`submitCheckin`、`confirmCheckin`、`manageMember`、`settleDay`。

本次更新后需要重新上传部署 `getDashboard`、`createTask`、`submitCheckin`、`confirmCheckin` 和 `settleDay`，并首次上传 `getLearningResources`、`seedTaskResources` 和 `manageTask`。其中 `settleDay` 用每天 23:00 的定时触发器执行，并在服务端以家庭和日期为唯一键，保证不会重复扣除白菜。
