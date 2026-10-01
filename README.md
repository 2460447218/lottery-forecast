# 双色球研究室

Vue 3 + Vite 前端工程。`src/` 存放页面组件、样式、选号与回测算法；`public/draws.json` 存放历史开奖；`npm run build` 生成供 Render 发布的 `dist/`。

## 本地开发

需要 Node.js 20.19+。运行 `npm ci` 安装依赖，`npm run dev` 启动开发服务器。运行 `npm test` 验证选号与计奖逻辑，`npm run build` 打包，`npm run preview` 预览构建结果。回测计算使用 Web Worker。

## Render 部署

在 Render 中选择 **New → Static Site**，连接此仓库的 `main` 分支，并填写：

- Build Command：`npm ci && npm run build && npm test`
- Publish Directory：`dist`

也可以使用仓库根目录的 `render.yaml` 创建 Blueprint。现有 Render 站点仍可直接发布仓库中提交的 `dist/` 构建产物，无需改变当前发布目录。站点无需环境变量或数据库。

## 开奖数据更新

运行 `node scripts/update-draws.mjs` 可获取官方最新开奖，并检查与已有期号是否一致。优先查询[中国福利彩票接口](https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice?name=ssq&pageNo=1&pageSize=30&systemType=PC)；如果该接口限制 GitHub 服务器访问，则读取[上海市福利彩票发行中心的官方历史页](https://appsh.swlc.net.cn/shfcoc_datachart/datachart/ssq/lskj/ls_award.html)作为备用来源。只有数据完整且核对通过才会修改 `public/draws.json`。GitHub Actions 每天北京时间 23:17 和次日 08:23 尝试更新；也可在 Actions 页手动运行 **Update SSQ draw history**。有新数据时，任务重新构建 `dist/`，将数据与构建产物一并提交到 `main`，Render 随仓库更新重新部署。两个公开来源均无需 API Key，也都不提供服务保障；若页面故障或开奖公告延迟，网站会保留最近一次成功同步的数据。

2003—2012 年的记录来自原始历史工作簿，尚未逐期完成官方核验；2013 年起已与中国福利彩票官方数据核对。

历史数据和选号结果仅供研究；过去的表现不能预测未来开奖。

图表使用 Apache ECharts，支持悬停明细、区间缩放和累计/逐期视图切换。生成参考号码时，摇奖机动画展示已计算好的号码；支持跳过动画，并尊重系统减少动态效果设置。
