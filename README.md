# 双色球研究室

静态网页与历史回测工具。历史开奖号码存放在 `dist/draws.json`，截至 2026-09-29，不会自动更新。

## Render 部署

在 Render 中选择 **New → Static Site**，连接此仓库的 `main` 分支，并填写：

- Build Command：`test -f dist/index.html && test -f dist/draws.json`
- Publish Directory：`dist`

也可以使用仓库根目录的 `render.yaml` 创建 Blueprint。站点无需环境变量或数据库。

## 本地验证

运行 `node verify.mjs` 检查选号、回测和计奖逻辑。网站入口是 `dist/index.html`。

历史数据和选号结果仅供研究；过去的表现不能预测未来开奖。
