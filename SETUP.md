# 修仙问答 - 完整部署指南

## 项目概述

修仙主题问答社区 Web 应用，包含提问、回答、评论、点赞、收藏、关注、消息通知、排行榜等功能。

**当前已部署**: `https://mazhenzhou1996.github.io/xiuixian-app/`（GitHub Pages，2026-08-11 更新，构建产物上传至 gh-pages 分支）

**历史部署**: CloudStudio `https://c2bff159809a475eb833c56f449448e4.bj5.agentos-app.net`（旧版，WorkBuddy 部署）

## 技术栈

- **前端**: React 19 + TypeScript + Vite + TailwindCSS + Radix UI
- **数据库**: Supabase (免费 PostgreSQL 云数据库)
- **认证**: Supabase Auth (手机号→邮箱转换方式)
- **部署**: 纯静态托管，无后端服务器需求

## 环境配置 (.env)

项目根目录 `.env` 文件包含所有凭据：

```
VITE_SUPABASE_URL=https://nwxtyxjborhrbesssopg.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_KEY=<your-service-role-key>
SUPABASE_DB_PASSWORD=<your-db-password>
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

> Windows 如果报权限错误:
> `npm install --cache .npm-cache`

### 2. 本地开发

```bash
npm run dev
```

前端运行在 `http://localhost:5173`，直接连接云端 Supabase 数据库。

### 3. 构建生产版本

```bash
npx vite build --outDir dist/build-new
```

> Windows 注意: vite 的 `emptyOutDir`/safe-delete 有兼容问题，用 `--outDir dist/build-new` 避开。
> 然后复制: `cp -r dist/build-new/* dist/client/`

### 4. 部署到云端

**方式一: Netlify CLI (推荐)**

```bash
# 首次使用: npx netlify-cli login
npx netlify-cli deploy --prod --dir=dist/client
```

**方式二: Vercel CLI**

```bash
# 首次使用: npx vercel login
npx vercel --prod
```

**方式三: Netlify Drop (最简单)**

1. 打开 https://app.netlify.com/drop
2. 把 `dist/client/` 文件夹拖进去
3. 完成，获得永久 HTTPS 地址

**方式四: 手动上传**

将 `dist/client/` 上传到任意静态托管平台：
- GitHub Pages
- 腾讯云 COS
- 七牛云
- 阿里云 OSS

**方式五: CloudStudio (WorkBuddy 专用)**

在 WorkBuddy 中告诉 AI: "部署 dist/client/ 到 CloudStudio"

### 5. 一键脚本

```bash
bash scripts/deploy.sh
```

## 目录结构

```
xiuixian-package/
├── .env                    # 云端凭据 (Supabase URL/Key/密码)
├── AI-GUIDE.md             # AI 助手指南 (WorkBuddy/AutoClaw 通用)
├── SETUP.md                # 本文件
├── src/                    # 前端源码
│   ├── index.tsx           # 入口 (HashRouter)
│   ├── app.tsx             # 路由配置
│   ├── lib/
│   │   ├── api.ts          # Supabase API 客户端
│   │   ├── supabase.ts     # Supabase 配置 (支持 .env + 硬编码回退)
│   │   └── utils.ts        # 工具函数
│   ├── store/
│   │   └── useStore.ts     # 状态管理
│   ├── pages/              # 页面组件
│   ├── components/         # 公共组件
│   ├── data/               # 静态数据
│   └── hooks/              # 自定义 hooks
├── server/                 # Express 后端 (可选, 非 Supabase 方案)
│   ├── server.js           # Express 服务器 + JSON 存储
│   ├── data.json           # JSON 数据文件 (种子)
│   └── package.json        # 后端依赖
├── db/                     # 数据库脚本
│   ├── supabase-schema.sql # Supabase 建表 SQL + RLS + RPC
│   ├── seed-supabase.cjs   # 种子数据脚本
│   └── run-schema-v2.cjs   # 自动建表脚本 (直连 PostgreSQL)
├── dist/client/            # 预构建前端 (可直接部署)
├── scripts/
│   ├── build.sh            # 构建脚本
│   └── deploy.sh           # 一键构建+部署脚本
├── api/index.js            # Vercel serverless 入口 (可选)
├── netlify.toml            # Netlify 部署配置
├── vercel.json             # Vercel 部署配置
├── package.json            # 前端依赖
├── vite.config.ts          # Vite 配置 (标准版)
├── tsconfig.json           # TypeScript 配置
├── eslint.config.mjs       # ESLint 配置
└── index.html              # HTML 入口
```

## 测试账号

| 手机号 | 昵称 | 密码 |
|--------|------|------|
| 13800138001 | 道友甲 | 123456 |
| 13800138002 | 文史爱好者 | 123456 |
| 13800138003 | 升学规划君 | 123456 |
| 13800138004 | 我爱巧克力 | 123456 |
| 13800138005 | 新道友 | 123456 |

## Supabase 数据库管理

### 重新建表

```bash
# 方式1: 脚本直连
node db/run-schema-v2.cjs

# 方式2: Supabase Dashboard → SQL Editor 粘贴 db/supabase-schema.sql
```

### 重新导入种子数据

```bash
node db/seed-supabase.cjs
```

## 常见问题

### Q: Vite build 在 Windows 上报错 "ENOTEMPTY"
A: 用新目录名构建: `npx vite build --outDir dist/build-new`，然后手动复制到 `dist/client/`

### Q: npm install 报权限错误
A: 加 `--cache` 参数: `npm install --cache .npm-cache`

### Q: 页面白屏
A: 检查 `src/index.tsx` 是否使用 `HashRouter`

### Q: 登录失败
A: Supabase Auth 用 email 注册，手机号自动转为 `手机号@xiuixian.app`。确保 Supabase 已关闭邮箱确认 (Settings → Auth → Email → 关闭 Confirm email)

### Q: API 请求失败
A: 检查 `src/lib/supabase.ts` 或 `.env` 中的 URL 和 anon key

## 技术要点

- **HashRouter** (非 BrowserRouter) — 兼容静态托管
- **UUID 用户 ID** — Supabase Auth 生成，不是数字
- **手机号→邮箱转换** — `phoneToEmail()` 函数
- **RLS 安全策略** — anon 可读公开数据，authenticated 才能写入
- **RPC 函数** — `toggle_like`, `toggle_follow` 等用 SECURITY DEFINER 绕过 RLS
- **无 @lark-apaas 依赖** — 标准 Vite + @vitejs/plugin-react
