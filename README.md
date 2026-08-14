# 修仙问答（v16 上线版）

修仙主题问答社区 Web 应用：提问、回答、评论、点赞、关注、私信、**Realtime 通知**、邀请码注册、付费咨询、悬赏榜、学校圈子、大学/研究生专题、匿名问答（后台审核）、内容自动审核、完整运营后台。

## 当前线上部署

- **EdgeOne Pages**（当前）：`xiuixian-app-wk2fm3y5.edgeone.cool`（私有模式，访问需 eo_token；重新部署生成新 token）
- **GitHub Pages**（历史）：`mazhenzhou1996.github.io/xiuixian-app`（旧版，gh-pages 分支）

## 功能清单

| 模块 | 功能 |
|---|---|
| 首页 | 大学/研究生/我的学校专题入口、本校热门横滑、关注动态、混合推荐流（个性化开关：本校+关注加权，设置页可关） |
| 热榜/排行榜 | 热度排序、境界榜单（按境界 RPC 查询，五境全）、悬赏金榜 |
| 关注 | 三页签：关注问题/关注回答/关注人，标记已读 |
| 问题详情 | 关注/分享/举报、学校标签→圈子、付费咨询（真实接通）、回答卡（赞同/点踩/赞赏/评论/赞同者列表[作者可见]/匿名显示/关注回答/举报） |
| 提问/回答 | **匿名开关（审核通过后公开）**、学校选择（392 所）、图片上传、富文本、草稿 |
| 通知中心 | **独立 notifications 表 + DB 触发器（回答/评论/点赞/关注/私信/邀请）+ Realtime 实时 + 60s 轮询兜底 + 分页加载** |
| 消息中心 | 板块列表（官方/私信/评论/点赞/关注/邀请）+ 回收箱（15 天可恢复） |
| 私信 | **Realtime 实时聊天**（无轮询）、举报 |
| 我的 | 消息/私信/收益（赞赏+咨询+悬赏汇总）/提问/回答/点赞/浏览历史 + 设置 + 个人主页 |
| 设置 | 隐私（关注列表可见性/一键防护/**隐藏主页内容**/**个性化推荐开关**）、账号、基本 |
| 专题 | 大学专题（选校→信息卡→九宫格→本校热门）、研究生专题、**学校圈子页**（/topic/school/:id） |
| 注册 | **邀请码制**（后台生成，防刷注册） |
| 审核 | **后台审核中心**：匿名审核/自动审核复核/关键词规则管理；本地词库 + 云 API（阿里云/腾讯云）双层 |
| 后台 | 13 个菜单：仪表盘（运营统计）/举报/审核中心/内容/用户/高校/九宫格/公告/咨询/变更回滚/邀请码 |

## 技术栈

React 19 + TypeScript + Vite 6 + Tailwind CSS v4 + shadcn/ui + **BrowserRouter** + Supabase（PostgreSQL + Auth + RLS + Realtime）+ PWA（可添加到主屏幕）

## 快速开始

```bash
cp .env.example .env        # 填入 Supabase 配置
npm install --registry=https://registry.npmmirror.com
npm run dev                 # http://localhost:5173
npm run typecheck           # 类型检查（0 错误）
npm run build               # 产出 dist/client
npm run preview             # 本地预览 http://localhost:4173
node scripts/prerender.cjs  # 预渲染静态页（SEO，build 后执行）
node scripts/gen-sitemap.cjs# 生成 sitemap
scripts/deploy-edgeone.cmd  # 一键部署 EdgeOne
```

## 数据库迁移（按顺序在 Supabase SQL Editor 执行）

```
db/migrations/ 按文件名顺序执行（v11 → v12 → v13 → v14 → v16）
```

- v11：匿名/学校标签/赞赏/收藏夹/自动审核基础
- v12：profiles.school + 邀请码系统
- v13：notifications 表 + 触发器 + Realtime
- v14：运营仪表盘统计
- v16：排行榜 RPC（按境界查询）、profiles.school_id 统一圈子绑定、save_my_school RPC

## 部署注意（重要）

1. **SPA fallback 必配**：项目使用 BrowserRouter，EdgeOne/任意静态托管必须配置「全部路径回退到 index.html」，否则刷新子路由（/question/123 等）404。EdgeOne 规则示例：路径 `*` → 重写到 `/index.html`（状态码 200）。
2. SEO 流程：`npm run build` → `node scripts/prerender.cjs`（生成问题详情静态页 + QAPage JSON-LD）→ `node scripts/gen-sitemap.cjs` → 部署。
3. 内容审核：默认本地关键词兜底；配置 `VITE_CONTENT_CHECK=aliyun|tencent` 后启用云审核（建议部署 Supabase Edge Function 做代理，勿把云密钥放前端）。

## 移动端 APK（Capacitor 打包）

项目已集成 Capacitor（android 工程已生成）。本机无需安装 Android Studio，**推送到 GitHub 后自动构建 APK**：

1. 把项目推到 GitHub（main/master 分支）
2. GitHub → Actions → **Build Android APK** → Run workflow（或 push 自动触发）
3. 构建完成后在 workflow 运行页下载 `xiuixian-apk` artifact（app-debug.apk，可直接安装到手机）

本地构建（需 JDK 17 + Android SDK）：
```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug   # 产物: android/app/build/outputs/apk/debug/app-debug.apk
```

注意：`.env` 里的 Supabase 配置在构建时注入前端产物，APK 内置的是**构建时**的配置；更换环境需重新构建。

## 测试账号

13800138001 / 123456（管理员，可看后台审核中心/邀请码）
13800138002 / 123456（普通用户）

## 详细文档

- `CHANGES.md`：v11→v16 变更记录
- `db/SCHEMA-README.md`：数据库表结构/RLS/RPC 说明
- `SETUP.md`：部署指南（历史）
- `AI-GUIDE.md`：AI 助手指南

## 重要约束（勿改）

1. vite.config.ts 必须保留 `@tailwindcss/vite` 插件（缺失=构建无样式）
2. `manualChunks` 拆分 vendor 时必须重新构建验证（历史教训：多分包曾导致 chunk 循环依赖白屏）
3. `base: './'` 相对路径（子路径部署必需）
4. `strip-css-crossorigin` 插件（EdgeOne 无 ACAO 头，Chromium 拒绝带 crossorigin 的样式）
5. 生产构建不开 sourcemap
