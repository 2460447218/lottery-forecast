# 双色球研究室

静态网页与历史回测工具。历史开奖号码存放在 `dist/draws.json`。2003—2012 年的记录来自原始历史工作簿；2013 年起与[中国福利彩票官方公开查询接口](https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice?name=ssq&pageNo=1&pageSize=30&systemType=PC)核对。

## Render 部署

在 Render 中选择 **New → Static Site**，连接此仓库的 `main` 分支，并填写：

- Build Command：`test -f dist/index.html && test -f dist/draws.json`
- Publish Directory：`dist`

也可以使用仓库根目录的 `render.yaml` 创建 Blueprint。站点无需环境变量或数据库。

## 本地验证

运行 `node verify.mjs` 检查选号、回测和计奖逻辑。网站入口是 `dist/index.html`。

## 开奖数据更新

运行 `node scripts/update-draws.mjs` 可获取官方最新开奖，并检查与已有期号是否一致。只有数据完整且核对通过才会修改 `dist/draws.json`。GitHub Actions 每天北京时间 23:17 和次日 08:23 尝试更新；也可在 Actions 页手动运行 **Update SSQ draw history**。有新数据时，任务提交到 `main`，Render 随仓库更新重新部署。该公开查询接口无需 API Key，但不是带服务保障的正式开发者 API；若接口故障或开奖公告延迟，网站会保留最近一次成功同步的数据。

历史数据和选号结果仅供研究；过去的表现不能预测未来开奖。
