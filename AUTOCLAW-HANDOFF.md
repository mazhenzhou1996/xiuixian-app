# 修仙问答 v22 · 上线交接文档（AutoClaw / AI 开发者）

> 生成日期：2026-08-14 ｜ 状态：**工程就绪度 100%**，仅余备案/密钥类个人操作。
> 本文件 + 完整源码 + `db/migrations/*.sql` 全部迁移 = 全部上下文。请按「§2 迁移执行顺序」逐条跑库，否则会漏表/漏 RPC 导致前端运行期报错。

---

## 0. 当前状态（已验证）

- ✅ `npm run typecheck` —— **0 错误**
- ✅ `npm run build` —— **成功**，`dist/client` 含 `index.html` + `404.html`（SPA fallback），分包：`vendor-react` / `vendor-charts`（仅后台）/ `vendor-misc`
- ✅ 内容审核已接 Supabase Edge Function（serverless，密钥不暴露，默认 fail-closed）
- ✅ 安卓工程已补全 `MainApplication.java`（可 `npx cap sync android && ./gradlew assembleRelease`）
- ✅ 死代码（examplepage）、并行分叉副本（xiuixian-launch-fixes）已清理

```bash
npm install
npm run typecheck   # 必须 0 错误
npm run build       # 产出 dist/client
```

---

## 1. 技术栈与架构（最省钱的形态）

- **前端**：React 19 + Vite 6 + TypeScript + Tailwind v4 + shadcn/ui + React Router（BrowserRouter）
- **后端**：Supabase（PostgreSQL + Auth + RLS + Storage + Realtime + Edge Functions），**无自建服务**
- **部署**：静态托管（EdgeOne Pages / Vercel / GitHub Pages / Netlify）+ Supabase 免费档
- **成本结构**：前端是纯静态（CDN 流量费极低，且 Service Worker 缓存复用后回访≈0 重传）；后端全托管按量计费，Edge Function scale-to-zero（不发帖不花钱）。**无常驻服务器 = 部署最省**。

---

## 2. 数据库迁移执行顺序（务必逐条执行，顺序敏感）

全部在 Supabase SQL Editor 或 `supabase db push` 执行。**幂等**（IF NOT EXISTS / OR REPLACE），可重复跑。

> ⚠️ 注意：v17 被跳过（编号从 v16 直接到 v18），不要以为漏了文件。

**基础层（用户/内容/治理/付费/高校）**
1. `20260813-p0-fixes.sql` — 私信/关注/举报表 + profiles_public 去敏视图 + Storage 桶 + 手机号脱敏
2. `20260813-admin-v2.sql` — 管理员角色/高校/九宫格/专题配置/变更日志/内容下架/回滚 RPC
3. `20260813-admin-v3.sql` — 用户惩罚/公告表 + 内容真删除 RPC
4. `20260813-admin-v4.sql` — 申诉表 + 九宫格广告解锁字段
5. `20260813-realm-v5.sql` — 境界等级表/晋级申请/声望加分触发器
6. `20260813-credit-v6.sql` — 信誉分/扣分流水/量化规则
7. `20260813-content-v7.sql` — 高校×服务内容表 + 批量导入 RPC
8. `20260813-consult-v8.sql` — 付费咨询（余额/设置/订单/退款/钱包）
9. `20260814-wallet-v10.sql` — 签到/余额流水/悬赏软删/后台发放
10. `20260814-bounty-v9.sql` — 悬赏榜（释放/追加/接取/认可分红/排名）
11. `20260814-fix-wallet-ambiguity.sql` — 钱包列名歧义修复
12. `20260814-fix-reports-constraint.sql` — 举报白名单修复
13. `20260814-fix-admin-users.sql` — 加 balance 列

**功能层（社区/SEO/通知/看板）**
14. `20260814-v11-community.sql` — 社区功能补齐
15. `20260814-v12-launch-gap.sql` — 邀请码注册/学校落库/SEO 基建
16. `20260814-v13-notifications.sql` — 实时通知全链路（表+5 触发器+4 RPC）
17. `20260814-v14-dashboard.sql` — 后台数据看板 `admin_dashboard_stats()`

**高级层（排行榜/认证/悬赏邀请/私信媒体）**
18. `20260814-v16-launch.sql` — 排行榜 RPC + 学校体系统一（`school_id` 外键）+ `create_question` 同步学校 + 视图 `security_invoker=true`
19. `20260814-v18-school-verify.sql` — 学校认证（申请/审核/认证修士列表）⚠️ 重建 `profiles_public` 视图
20. `20260814-v19-invite-bounty.sql` — 问题悬赏 + 邀请回答（依赖 v13 `fn_insert_notification`、v18 `school_verified`）
21. `20260814-v20-pm-media.sql` — 私信图片/视频类型

**依赖链**：v13 → v16 → v18 → v19 → v20 必须按此顺序（v18/v19 重建/引用了前面的视图与函数）。**漏跑任一都会让前端调不存在的 RPC → 运行期报错**，所以这份顺序表是部署的唯一真相。

---

## 3. 环境变量（`.env`，勿提交 git）

```bash
# 前端公开配置
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>

# 内容审核：前端仅声明启用 + 失败策略；密钥在 Supabase Secrets（见 §4）
VITE_CONTENT_CHECK=tencent          # aliyun | tencent（不设则仅本地关键词兜底）
VITE_CONTENT_CHECK_FAIL_CLOSED=true # 云端不可达即拦截（生产保持 true；开发可设 false）

# 广告解锁（可选）：pangle | gdt | adsense（默认 mock 模拟 5 秒）
# VITE_AD_MODE=mock
```
服务端脚本专用（db/*.cjs、scripts/*.cjs，勿暴露前端）：`SUPABASE_SERVICE_KEY`、`SUPABASE_DB_HOST/PORT/NAME/USER/PASSWORD`。

---

## 4. 内容审核 Edge Function（合规闸门，必配）

密钥**只存 Supabase Secrets**，前端永不接触。

```bash
supabase functions deploy content-check
supabase secrets set CONTENT_CHECK_PROVIDER=tencent
supabase secrets set CONTENT_CHECK_SECRET_ID=<腾讯云 SecretId>
supabase secrets set CONTENT_CHECK_API_KEY=<云厂商密钥>
supabase secrets set CONTENT_CHECK_FAIL_CLOSED=true   # 默认即 true
```
- 支持 `tencent`（天御 TC3-HMAC-SHA256，已内置真实签名）/ `aliyun`（绿网 RPC HMAC-SHA1 骨架）。
- 默认 fail-closed：云不可用时拦截发布，满足内容安全红线。
- 服务端再跑一遍本地关键词双保险（防前端被绕过）。

---

## 5. 安卓 APK 构建（Capacitor）

```bash
npm run build                      # 先产出 dist/client（capacitor.webDir）
npx cap sync android              # 同步前端到安卓工程
# 在已装 Android Studio + SDK 的机器上：
cd android && ./gradlew assembleRelease   # 出 release APK（需签名）
```
- 已补全 `android/app/src/main/java/com/xiuixian/app/MainApplication.java`（Capacitor 必需入口，Manifest 已注册）。
- 本仓库未含签名密钥与 Android SDK，**出包需你在本机完成**（属个人操作）。

---

## 6. 静态部署（SPA fallback 必开）

任意静态托管均可，关键是「未命中静态文件回退到 index.html」：
- **EdgeOne Pages / Vercel**：构建命令 `npm run build`，输出 `dist/client`，开启 SPA rewrite。
- **GitHub Pages / Netlify**：构建已自动复制 `404.html` 作为 fallback。
- 公网域名需 **ICP 备案** 后开通（见 §8）。

---

## 7. 开发约定（重要）

1. 文件名一律小写（目录+文件）：Windows tsc 对大小写混用报 TS1261。
2. 前端数据层：`src/lib/api.ts`（用户侧）+ `src/lib/adminapi.ts`（管理侧，写操作自动记 admin_change_log）+ `src/lib/supabase.ts`（client）。
3. 所有用户写操作走 RPC（数据库校验禁言/余额/权限），不要前端直接 insert。
4. RLS：内容 `status='active'` 才可读；管理员 `is_admin()` 全权；私有数据只读自己。
5. `useXiuxianStore` 为每组件独立实例（非全局单例），页面切换会重初始化，已加 3 秒重试。
6. 迁移可重复执行：全部 SQL 用 IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS。

---

## 8. 上线前「只留给你本人」的操作（非代码可解）

| # | 事项 | 说明 | 复杂度 |
|---|---|---|---|
| 1 | **ICP 备案** | 域名 + 服务器在大陆需工信部备案（约 1–2 周） | 填表 + 人脸核验 |
| 2 | **公安备案** | 上线后 30 日内在全国互联网安全管理服务平台报备 | 填表 |
| 3 | **增值电信（若开付费咨询）** | 付费咨询涉及经营，需 ICP 经营许可证（EDI） | 资质+材料 |
| 4 | **内容审核云密钥** | 在 §4 填入你的腾讯云/阿里云 SecretId/Key | 复制粘贴 |
| 5 | **Reset service_role key** | 历史密钥可能外泄，上线前在 Supabase 后台重置并更 `.env` | 点几下 |
| 6 | **安卓签名 + 出包** | §5 在本机 Android Studio 完成 | 本机操作 |
| 7 | **实名/短信（注册风控）** | 接短信验证码（阿里云/腾讯云 SMS）做注册人机校验 | 配置 |

> 不等备案也能先公测：用「已备案域名 CNAME + 海外/灰度节点 + 邀请制内测」小范围放行。

---

## 9. v22 本轮相较 v21 的修复清单

- 🔧 重写本交接文档：迁移顺序补全到 v13→v16→v18→v19→v20（v21 漏列，按旧文档部署会漏库结构）
- 🔧 内容审核改为 Supabase Edge Function（`supabase/functions/content-check/index.ts`），密钥不出前端，默认 fail-closed
- 🔧 安卓补 `MainApplication.java` + Manifest 注册
- 🔧 资源最小化：vendor 分包（charts 仅后台加载）、SW 缓存名稳定化（回访≈0 重传）、删除死代码与并行分叉副本
- ℹ️ npm audit 仍有 3 个 moderate（uuid→xcode→@capacitor/cli），**仅 dev 依赖、不进生产包**，未强制升级以免破坏安卓工具链
