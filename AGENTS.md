# 白菜守护计划

这是原生微信小程序。页面在 `pages/`，云函数在 `cloudfunctions/`，资料导入和核验脚本在 `scripts/`。本地启动见 [README.md](README.md)。

## 英语资料库

- 保持「我的世界单词卡」筛选覆盖 001–160。保留跨主题的同名单词卡。「我的世界菜单单词」与「三上英语单词拼写」各自使用独立页签。
- 修改资源查询或分类后，从仓库根目录运行 `node scripts/test-resource-categories.js`。验证小程序时，分别检查「全部」和「我的世界单词卡」，确认后者包含第 160 张。
- 导入资源前读 [scripts/README.md](scripts/README.md)，预览并核对目标环境、家庭、分类和条目数后再写入。密钥保存在被 Git 忽略的 `.env.resource-import.local` 中，本机配置、导入清单和临时素材留在本地。

## 云函数部署

- 涉及部署或初始化资源库时，先读 [cloudfunctions/README.md](cloudfunctions/README.md)，确认目标环境与需更新的云函数。
- 交付云函数改动时，分别报告本地检查、云端部署、小程序验证的实际结果。
