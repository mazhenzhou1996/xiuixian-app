# AI 助手指南 - 如何更新修仙问答项目

> 本文件给 WorkBuddy / AutoClaw 或任何 AI 编程助手使用。
> 读完此文件即可理解项目结构并执行更新+部署。

## 项目概况

修仙主题问答社区 Web 应用。前端 React + TypeScript + Vite，数据库用 Supabase（免费 PostgreSQL 云数据库），纯静态部署（无后端服务器需求）。

**当前云端部署地址**: `https://c2bff159809a475eb833c56f449448e4.bj5.agentos-app.net`

## 关键架构决策

1. **HashRouter** — 静态部署兼容（`src/index.tsx`），不是 BrowserRouter
2. **用户 ID 是 UUID 字符串** — Supabase Auth 生成，不是数字
3. **手机号 → 邮箱转换** — Supabase Auth 用 email，手机号通过 `phoneToEmail()` 转为 `手机号@xiuixian.app`
4. **无后端服务器** — 前端直连 Supabase，RLS 策略保护数据安全
5. **`@lark-apaas/*` 依赖已全部移除** — 使用标准 Vite + @vitejs/plugin-react

## 云端凭据 (.env 文件)

所有凭据在项目根目录 `.env` 文件中：

```
VITE_SUPABASE_URL=https://nwxtyxjborhrbesssopg.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_KEY=<your-service-role-key>
SUPABASE_DB_PASSWORD=<your-db-password>
```

`src/lib/supabase.ts` 同时支持环境变量和硬编码值，默认已填入实际凭据。

## 更新流程

### 场景 A: 修改前端代码后重新部署

```bash
# 1. 安装依赖 (如果 npm 有权限问题，加 --cache 参数)
npm install
# 或: npm install --cache .npm-cache

# 2. 构建前端 (Windows 上 vite safe-delete 有 bug，用新目录名)
npx vite build --outDir dist/build-new

# 3. 复制到 dist/client
mkdir -p dist/client && cp -r dist/build-new/* dist/client/

# 4. 部署到云端 (选一种)
#    方式1: Netlify CLI
npx netlify-cli deploy --prod --dir=dist/client
#    方式2: Vercel CLI
npx vercel --prod
#    方式3: 手动上传 dist/client/ 到 Netlify Drop (https://app.netlify.com/drop)
#    方式4: WorkBuddy 专用的 CloudStudio 部署
```

### 场景 B: 修改数据库结构

```bash
# 1. 修改 db/supabase-schema.sql
# 2. 直连数据库执行 (需要 pg 包)
NODE_PATH=node_modules node db/run-schema-v2.cjs
# 或在 Supabase Dashboard → SQL Editor 粘贴执行

# 3. 重新导入种子数据 (如果需要)
node db/seed-supabase.cjs
```

### 场景 C: 只修改数据库数据（不需要重新部署前端）

直接通过 Supabase Dashboard 修改，或用脚本：
```bash
# 用 service_role key 操作数据库
# 详见 db/seed-supabase.cjs 中的操作方式
```

## Windows 注意事项

1. **Vite build 报 ENOTEMPTY** — Windows safe-delete 兼容问题，用 `--outDir dist/build-new` 换目录名
2. **npm 权限问题** — 加 `--cache` 参数指定缓存目录: `npm install --cache .npm-cache`
3. **路径分隔符** — bash 脚本中用 `/`，PowerShell 中用 `\`

## 文件结构速查

| 路径 | 用途 |
|------|------|
| `.env` | 所有云端凭据 |
| `src/lib/supabase.ts` | Supabase 客户端初始化 |
| `src/lib/api.ts` | 所有 API 调用 (Supabase 版) |
| `src/store/useStore.ts` | 状态管理 (用户/问题/回答/评论等) |
| `src/index.tsx` | 入口 (HashRouter) |
| `src/app.tsx` | 路由配置 |
| `src/pages/` | 所有页面组件 |
| `src/components/` | 公共组件 (Radix UI 等) |
| `db/supabase-schema.sql` | 数据库建表 SQL |
| `db/seed-supabase.cjs` | 种子数据脚本 |
| `db/run-schema-v2.cjs` | 自动建表脚本 (直连 PostgreSQL) |
| `dist/client/` | 预构建前端 (可直接部署) |
| `scripts/deploy.sh` | 一键构建+部署脚本 |
| `netlify.toml` | Netlify 部署配置 |
| `vercel.json` | Vercel 部署配置 |

## 测试账号

| 手机号 | 昵称 | 密码 |
|--------|------|------|
| 13800138001 | 道友甲 | 123456 |
| 13800138002 | 文史爱好者 | 123456 |
| 13800138003 | 升学规划君 | 123456 |
| 13800138004 | 我爱巧克力 | 123456 |
| 13800138005 | 新道友 | 123456 |

## Supabase Auth 配置要求

- Settings → Auth → Email provider: **关闭 Confirm email** (否则注册后需邮箱确认)
- Settings → Auth → URL Config: 添加部署域名到 Redirect URLs

## 部署平台选择

| 平台 | 免费 | 自动HTTPS | CLI部署 | 推荐度 |
|------|------|----------|--------|--------|
| Netlify | 永久 | 是 | `npx netlify-cli deploy --prod` | ★★★★★ |
| Vercel | 永久 | 是 | `npx vercel --prod` | ★★★★ |
| Netlify Drop | 永久 | 是 | 浏览器拖拽上传 | ★★★★ |
| CloudStudio | 永久 | 是 | WorkBuddy 专用 | ★★★ |
| GitHub Pages | 永久 | 是 | git push | ★★★ |
| 七牛云/腾讯COS | 有免费额度 | 需配置 | CLI上传 | ★★ |
