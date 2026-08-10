# Codex 资源直传

1. 复制 `.env.resource-import.example` 为仓库根目录的 `.env.resource-import.local`，填写 `TCB_ENV_ID`、`TCB_SECRET_ID`、`TCB_SECRET_KEY`。该文件已被 Git 忽略；请勿把密钥写入清单或提交 Git。
2. 复制 `resource-import.manifest.example.json` 为仓库根目录的 `.resource-import.local.json`，填写图片绝对路径、名称和解析后的正文。
3. 执行 `npm install`，再执行：

```powershell
npm run import:resources -- --manifest .resource-import.local.json
```

先运行预览。确认输出的家庭、分类与资源名称无误后，追加 `--apply` 执行上传：

```powershell
npm run import:resources -- --manifest .resource-import.local.json --apply
```

图片存入云存储 `resource-images/import/`；云数据库只保存 `cloud://` 文件 ID。相同图片以内容指纹去重，重复运行不会新增重复资源。

## 公共资源图片迁移

将仓库内现有的公共单词卡图片迁移到云存储并更新资源记录：

```powershell
npm run migrate:public-images
npm run migrate:public-images -- --apply
```

确认第二条命令完成后，才可删除 `assets/english-cards/` 中的本地图片。
