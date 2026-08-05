# 云函数清单

部署时创建：`getDashboard`、`submitCheckin`、`confirmCheckin`、`settleDay`。其中 `settleDay` 用每天 21:00 的定时触发器执行，并在服务端以家庭和日期为唯一键，保证不会重复扣除白菜。
