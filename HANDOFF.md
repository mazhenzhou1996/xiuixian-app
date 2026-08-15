# xiuixian（修仙问答）— autoclaw 接手文档

> 本文件随工程一起打包，供 AI 开发工具（autoclaw）或后续开发者快速接手。
> 版本基线：本地 **v31**（在桌面 `xiuixian-app-v30-20260814.zip` 的 v30 之上，由 2026-08-15 会话大量迭代而来）。

---

## 1. 项目是什么

React + Vite + TypeScript + Tailwind CSS + Supabase 的**校园社区问答 Web 应用**，对标知乎级别，含表白墙、悬赏榜、学校圈子、付费/收益、后台管理等模块。目标：知乎级正式上线。

- 前端：SPA（HashRouter → 见 `src/App.tsx`，React.lazy 全页分包）
- 后端：**Supabase（Postgres + RPC）**，无本地迁移脚本；所有数据读写走远程 RPCs
- 部署：GitHub Pages（由 `gh-pages` 分支提供静态文件）

---

## 2. 本地运行（三步）

```bash
npm install          # Node 22；依赖已锁定
npm run dev          # 本地开发，http://localhost:5173
npm run build        # 生产构建 → 输出 dist/client（含 404.html SPA 回退）
npm run preview      # 本地预览构建产物
npm run typecheck    # tsc 类型检查（0 错误为健康线）
```

Supabase 凭据**已硬编码**在 `src/lib/supabase.ts`（URL + anon key），无需环境变量即可联调。
若要换库，改 `supabase.ts` 即可。

---

## 3. ⚠️ 必须先在 Supabase 执行 SQL（否则新功能报错/无效果）

文件：`sql/confession_features_v31.sql`（幂等，`create or replace` 可重复执行）。

**执行位置**：Supabase 控制台 → SQL Editor → 粘贴全部内容 → Run。

它提供的后端函数（前端 `src/lib/features.ts` / `src/lib/adminapi.ts` 已封装对应调用）：

| 函数 | 作用 |
|---|---|
| `pay_create_confession` | 表白发布，**扣 ¥1**（余额不足则拒绝） |
| `pin_confession_paid` | 表白置顶，**扣 ¥5/天** |
| `delete_my_confession` | 作者删除自己的表白 |
| `update_confession_story` | 补充「故事后续」（作者/双方均可） |
| `accept_confession` | **被表白人「接受」**（传截图） |
| `confirm_confession` | **表白人「确认关系」**（传截图，双方确认后标记 confirmed_at） |
| `admin_delete_confession` / `admin_pin_confession` / `admin_feature_confession` / `admin_reject_confession` / `admin_update_confession` | 后台删除/置顶/精选/驳回/编辑内容 |

> **未执行该 SQL 时**：相关按钮会优雅提示「需先执行 SQL 升级」，不会崩。
> 表白墙的字段扩展（`amount` / `story_update` / `accepted_at` / `poster_confirmed_at` / `confirm_screenshot_a/b` / `confirmed_at` / `featured` / `pinned`）也由该脚本一并 `ALTER TABLE` 补齐。

---

## 4. 本次（v31）已完成的核心改动

**表白墙 · 双方确认关系流（重点）**
- 默认进入「精选」tab；精选 = `featured` / 有「故事后续」 / 双方已确认 的表白
- 流程：**被表白人「接受」→ 表白人「确认关系」→ 双方各传截图 + 补充后续**
- 作者（表白人）可删除、置顶、精选；被表白人/其他人可「举报」
- 「精选故事」已从独立页面合并进表白墙（原 `/featured` 路由已删除）

**主页**
- 顶部专题卡片紧凑化（3 列小卡）
- 去除「查看详情」「进入圈子」文案
- 新增「精选故事」入口（跳转 `/wall`）
- 问题列表默认加载更多（store 改为 40 条）

**付费 / 收益**
- 平台 **20% 服务费**透明展示（`src/lib/features.ts` 的 `PLATFORM_FEE_RATE = 0.20`，仅展示，真实扣费见 §6 待办）
- 首页右上角「签到送 1 元」（`checkin` RPC）
- 醒目「账户充值」入口、付费功能页「收支详情」
- 悬赏 0 元不允许发布，余额不足引导签到/充值

**后台**
- 新增表白管理页 `src/pages/admin/adminconfessionspage.tsx`（删除/置顶/精选/编辑/驳回）
- 举报中心 `adminreportspage.tsx` 接入 `confession` 举报类型

---

## 5. 部署（GitHub Pages / gh-pages）

1. `npm run build` → 产物在 `dist/client`
2. 在 `dist/client` 根目录放一个 `.nojekyll`（防止 GitHub Pages 用 Jekyll 处理 SPA）
3. 把 `dist/client` 内容推送到仓库的 **`gh-pages`** 分支（Pages 源设为 gh-pages / root）
4. 线上地址：`https://mazhenzhou1996.github.io/xiuixian-app/`

> 项目自带 `scripts/deploy-github-pages.ps1`，但需要 GitHub PAT 入参。
> 也可手动：`git checkout --orphan gh-pages-deploy` → 拷 `dist/client/*` 到根 → `git add -A` → 强推 `gh-pages`。

**Windows 构建坑**：`vite build` 偶发 `EPERM`（Defender/索引锁住 `dist/client` 写入）。
- 临时方案：给项目目录加 Defender 排除项，或用 `npm run build:clean`（`--emptyOutDir` 到新目录名）。
- `vite.config.ts` 已设 `emptyOutDir:false` + 自定义 `spa-fallback-404` 插件兜底 404.html。

---

## 6. GitHub 推送现状（重要，接手时务必看清）

- 远程 `main` **仍是 v29**（`dd8b0c37013d7978bb3e86a8e36bb130cd4d4007`），本会话的 v31 改动**尚未成功推上远程**。
- 失败原因：所用 PAT 仅含 `repo` 权限、**缺 `workflow` 权限**，GitHub 拒绝推送/修改 `.github/workflows/*.yml`（CI/APK 流程）。
- 本地提交：
  - `main` = `f64f023`（含 CI workflows 的**完整版**）
  - `deploy-clean` = 去掉 workflows 的干净版（曾试图绕过限制强推，未成功）
- **建议**：用**带 `workflow` 权限的 PAT** 推送 `main`；或接受 CI/APK workflows 不入库（网页上线不需要它们）。

---

## 7. 已知待办 / 风险（按优先级）

- **P0 — vendor 分包**：`recharts` 被打包进单一 `vendor` chunk（约 1.22MB），首屏偏大。建议把图表单独 lazy 分包（`manualChunks` 已留注释位）。
- **平台服务费真实扣费**：当前仅前端透明展示。真实扣费需在 Supabase 改 `create_item_bounty` / `create_question` RPC，增加 `service_fee` 字段与扣费逻辑（前端字段已就绪）。
- **匿名表白**：后端 `create_confession` 无匿名字段，匿名能力需后端加字段 + 前端联动。
- **SEO**：`index.html` 的 canonical/og 已指向 `https://mazhenzhou1996.github.io/xiuixian-app/`（正确），可保持不变。
- **余额/钱包**：付费功能依赖 `wallets` 表（cap ¥100 上限）、`get_my_wallet` / `get_my_balance_logs` 等 RPC，均在远程，无法本地改。

---

## 8. 给 autoclaw 的推荐切入点

1. **先执行 `sql/confession_features_v31.sql`** → 表白墙双方确认/置顶/精选/举报全部生效。
2. 用**带 `workflow` 权限的 PAT** 把 `main` 推上 GitHub，并部署 `gh-pages` 上线。
3. 实现平台服务费**真实扣费**（改 Supabase RPC）。
4. 优化 `vendor` 分包，降低首屏体积。
5. 视需求补匿名表白后端能力。

---

## 9. 关键文件速查

| 文件 | 说明 |
|---|---|
| `src/pages/confessionwallpage/confessionwallpage.tsx` | 表白墙（双方确认流、精选、举报、个人管理） |
| `src/pages/homepage/homepage.tsx` | 主页（紧凑选项卡、精选故事入口） |
| `src/pages/admin/adminconfessionspage.tsx` | 后台表白管理 |
| `src/pages/admin/adminreportspage.tsx` | 举报中心（含 confession 类型） |
| `src/lib/features.ts` | 前端 RPC 封装（`PLATFORM_FEE_RATE`、`createItemBounty`、`payCreateConfession` 等） |
| `src/lib/adminapi.ts` | 后台 RPC 封装 |
| `src/lib/supabase.ts` | Supabase 凭据（硬编码） |
| `src/store/useStore.ts` | 全局状态（问题列表默认 40 条） |
| `sql/confession_features_v31.sql` | **必须执行的后端升级脚本** |
| `vite.config.ts` | 构建配置（outDir=dist/client、base='./'、SPA fallback） |
| `scripts/deploy-github-pages.ps1` | Pages 部署脚本（需 PAT） |
