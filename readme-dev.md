# 修仙问答 - 项目开发指南（OpenClaw 续用版）

## 项目概述

修仙主题问答社区 Web 应用：提问、回答、评论、点赞、关注、私信、消息（含回收箱）、设置、大学/研究生专题等。

**当前线上部署**: 腾讯云 EdgeOne Pages
- 项目名: `xiuixian-app`（项目ID: makers-hcurm8v7ymcv）
- 访问: `https://xiuixian-app-wk2fm3y5.edgeone.cool`（私有模式，访问需带 eo_token 参数，过期后重新部署生成新 token）
- 部署命令: `edgeone pages deploy dist/client -n xiuixian-app -e production`（需 edgeone CLI 登录态）

**历史部署**: GitHub Pages `https://mazhenzhou1996.github.io/xiuixian-app/`（gh-pages 分支，旧版）

## 技术栈

- 前端: React 19 + TypeScript + Vite 6 + Tailwind CSS v4（@tailwindcss/vite 插件，勿删！缺失会导致构建无样式）
- UI: shadcn/ui + lucide-react + framer-motion
- 数据库/认证: Supabase（anon key 前端直连，RLS 保护）
- 路由: react-router-dom v7（HashRouter）

## 关键配置（vite.config.ts）

- `base: './'`：相对路径，兼容子路径/平台部署（勿改回绝对路径）
- `build.sourcemap: false`：生产不输出 sourcemap
- `manualChunks`：所有 node_modules 合并为单一 vendor chunk（**勿拆多个 vendor**，会引发 chunk 循环依赖导致白屏：Cannot access 's' before initialization）
- Tailwind 插件必须存在：`tailwindcss()` from `@tailwindcss/vite`
- `strip-css-crossorigin` 插件：去掉 stylesheet 的 crossorigin（EdgeOne 无 ACAO 头，Chromium 会拒绝样式）

## 开发命令

```bash
npm install            # 安装依赖（--registry=https://registry.npmmirror.com 加速）
npm run dev            # 开发服务器 http://localhost:5173
npm run build          # 构建到 dist/client
npx tsc -p tsconfig.app.json --noEmit   # 类型检查（项目原有少量类型告警，不影响构建）
```

## 部署（EdgeOne Pages）

```bash
# 已登录后
edgeone pages deploy dist/client -n xiuixian-app -e production --json
# 输出 url 即带 eo_token 的访问地址
```

EdgeOne 私有模式：不带 token 访问返回 401；带 token 访问 302 种 cookie（3 小时有效）。
**默认域名无法关闭访问保护**（平台强制），只有绑定已备案自定义域名才能公开。

## 数据库（Supabase）

- 项目 ref: `nwxtyxjborhrbesssopg`
- 凭据在 `.env`（VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / SUPABASE_SERVICE_KEY / SUPABASE_DB_*）
- 建表/种子脚本: `db/` 目录
  - `run-schema-v2.cjs`：直连 PostgreSQL 建表（密码在脚本 PASSWORD 常量）
  - `seed-supabase.cjs`：种子数据（service key REST）
  - `init-invites.cjs`：invites 表 + 演示邀请数据（直连）
  - `seed-messages.cjs`：演示消息（关注/点赞/回答）
  - `seed-questions-extra.cjs` / `seed-topics.cjs`：演示问题
- **注意**: `.env` 里的 DB 密码可能是掩码占位符，真实值在 `db/run-schema-v2.cjs` 的 PASSWORD 常量

## 测试账号

| 手机号 | 昵称 | 密码 |
|--------|------|------|
| mazhenzhou1996@163.com | 管理员 | 自行设置 |

| 13800138003 | 升学规划君 | 123456 |

## 本地功能说明（localStorage 存储，跨设备不共享）

- 关注问题 / 关注回答 / 私信消息 / 浏览历史 / 用户设置（位置/学校/图片模式/隐私）/ 消息回收站 / 学校选择
- 服务端数据: 问题、回答、评论、点赞、收藏、关注、邀请、消息源

## 页面路由

- `/` 首页（大学/研究生专题 + 推荐列表）
- `/hot` 热榜 `/rank` 排行榜 `/follow` 关注（问题/回答/人 三页签）
- `/search` 搜索
- `/question/:id` 问题详情
- `/answer/:questionId` 写回答
- `/comments/:answerId` 评论
- `/messages` 消息（板块列表）`/messages/:type` 板块 `/messages/trash` 回收箱 `/messages/private` 私信列表 `/messages/private/:userId` 聊天
- `/my/questions` `/my/answers` `/my/likes` `/my/history` 我的子页
- `/profile` 我的 `/settings*` 设置 `/user/:id` 道友主页
- `/topic/university` 大学专题 `/topic/graduate` 研究生专题

## 已知待办

- 付费咨询、私信服务端化（当前本地演示）、举报后台、头像外链存储优化
- 关注量/收藏量服务端化（当前 localStorage）
- invites 表已建（用户执行过 SQL 后生效）

## 排错速查

- 页面白屏: 看浏览器 console 是否有 `Cannot access 's' before initialization`（chunk 循环依赖，检查 manualChunks 是否被拆多）
- 页面无样式: 检查 @tailwindcss/vite 插件是否在 vite.config.ts
- 线上 401: EdgeOne 私有模式 token 过期，重新部署拿新 token
- 消息页报错: 检查 import 的图标是否都有对应引用
