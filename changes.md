# 修仙问答 v11 社区版 · 改造交付说明（2026-08-14）

本包在「xiuixian-full-src-20260814」基础上完成 24 项需求改造，**typecheck 0 错误、生产构建通过**。

---

## 一、24 项需求落地对照

| # | 需求 | 状态 | 实现位置 |
|---|---|---|---|
| 1 | 匿名提问/回答 + 后台审核 | ✅ | `db/migrations/20260814-v11-community.sql`；提问页/回答页匿名开关；后台「审核中心」页 |
| 2 | 话题标签选学校 | ✅ | 提问页学校选择器（392 所）；问题卡/详情页学校标签 → 学校圈子 |
| 3 | 回答（富文本/草稿） | ✅ 保持 | — |
| 4 | 评论/楼中楼 | ✅ 保持 | — |
| 4b | 感谢=赞赏（余额） | ✅ | `create_tip` RPC（余额扣款/答主入账/封顶 100/双向流水）；回答卡赞赏按钮 |
| 4c | 赞同者列表（作者可见） | ✅ | `get_likers` RPC（仅答主/评论作者+管理员，服务端校验） |
| 5 | 收藏夹 | ✅ | favorites.folder 字段；收藏页文件夹分组/新建/移动 |
| 5b | 关注动态流 | ✅ | `get_follow_feed` RPC；首页「关注动态」板块 |
| 5c | 主页显示提问回答 + 隐藏开关 | ✅ | 道友主页 tab 已有；隐私设置「隐藏主页内容」开关（profiles.hide_content） |
| 6 | 话题专栏去掉 | ✅ 按确认不做 | — |
| 7 | 私信 | ✅ 保持（5 秒轮询） | — |
| 8 | 信息流优化 | ✅ | 首页混合流：本校热门 + 关注动态 + 热度推荐，多卡片类型 |
| 9 | 学校热门推送 | ✅ | questions.school_id 聚合；大学/研究生专题统一推送本校热门（`get_school_feed`） |
| 10 | 通知消息中心 | ✅ 保持+修复 | getMessages 类型修复、invites 消息 userId 修复 |
| 11 | 热榜 | ✅ 保持 | — |
| 12 | 学校圈子 | ✅ | 新页面 `/topic/school/:id`（本校问题热榜 + 985/211 标识） |
| 13 | 专栏文章 | ✅ 按确认不做 | — |
| 14 | 想法动态 | ✅ 按确认不做 | — |
| 15 | 创作中心收益 | ✅ | 新页面 `/my/earnings`（赞赏/咨询/悬赏/余额四类汇总，`get_my_earnings`） |
| 16 | 付费咨询 | ✅ 收尾 | 去掉「即将上线」占位，接通真实咨询弹窗（答主未开通显示置灰） |
| 17 | 悬赏 | ✅ 保持 | — |
| 18 | 举报+自动审核 | ✅ | `auto_review_rules` 关键词库 + `check_content` + 命中自动隐藏入 `content_reviews` 人工复核队列；后台「审核中心」三 tab（匿名审核/自动审核复核/规则管理） |
| 19 | 反作弊 | ✅ | create_question/create_answer RPC 内封禁校验；签到封顶/信用分保持 |
| 20 | 后台优化 | ✅ | 新增「审核中心」菜单（匿名审核+内容复核+规则管理） |
| 21 | 信用分申诉+封禁模式 | ✅ | 申诉已有；RPC 层封禁只读；Layout 封禁/禁言横幅已有 |
| 22 | 移动端 | ✅ | 响应式已有；新增 PWA manifest（可添加到主屏幕） |
| 23 | 成本优化 | ✅ | store 模块级缓存+请求去重（366 请求雪崩根除）；列表分页 range 20；搜索 pg_trgm 索引；删除废弃 server/api/Dockerfile/vercel.json |
| 24 | 个性化推荐开关 | ✅ | profiles.enable_personalized；隐私设置开关；开启=学校+关注+热度加权，关闭=纯热度 |

---

## 二、部署步骤（Supabase 侧必做）

### 1. 执行数据库迁移（必做，否则新功能报错）

在 Supabase Dashboard → SQL Editor 执行 `db/migrations/20260814-v11-community.sql`（幂等，可重复执行）。

迁移内容：
- 新表：anonymous_reviews（匿名审核）、tips（赞赏）、auto_review_rules（关键词规则）、content_reviews（自动审核复核）
- 新字段：questions(is_anonymous/status/school_id)、answers(is_anonymous/status/tip_count/tip_amount)、comments(status)、favorites(folder)、profiles(hide_content/enable_personalized)
- **RLS 收紧**：内容仅 status='active' 或作者/管理员可见（存量数据默认 active 不受影响）
- 新 RPC：create_question / create_answer / review_anonymous / list_anonymous_reviews / review_content / list_content_reviews / create_tip / get_likers / get_follow_feed / get_school_feed / get_my_earnings / move_favorite / list_schools / check_content

### 2. 安全检查（上线前必做）
- [ ] 重生 Supabase service role key（旧 key 曾随 .env 分发）
- [ ] 从分发包剔除 .env
- [ ] 后台「审核中心 → 关键词规则」添加初始敏感词
- [ ] 内容审核 API（阿里云/腾讯云）接入预留：`src/lib/adprovider.ts` 同级可扩展 `contentcheck.ts`

### 3. 测试账号
- mazhenzhou1996@163.com（管理员）


### 4. 本地验证
```bash
npm install --registry=https://registry.npmmirror.com
npm run typecheck   # 0 错误
npm run build       # 产出 dist/client
npm run preview     # http://localhost:4173
```

---

## 三、新增/改动文件清单

**新增**
- `db/migrations/20260814-v11-community.sql` — 全部数据库迁移
- `src/pages/myearningspage/myearningspage.tsx` — 我的收益
- `src/pages/schoolcirclepage/schoolcirclepage.tsx` — 学校圈子
- `src/pages/admin/adminreviews.tsx` — 后台审核中心
- `public/manifest.webmanifest` — PWA 清单
- `src/vite-env.d.ts` — vite 类型声明

**改动**
- `src/lib/api.ts` — 发布走 RPC（封禁校验+自动审核+匿名）、分页、20+ 新方法、类型修复
- `src/store/useStore.ts` — 模块级缓存+请求去重（成本优化核心）、prefs、新方法
- `src/pages/askpage/askpage.tsx` — 匿名开关 + 学校选择
- `src/pages/answereditorpage/answereditorpage.tsx` — 匿名开关
- `src/components/AnswerCard.tsx` — 赞赏/赞同者列表/匿名显示/付费咨询接通
- `src/pages/questiondetailpage/questiondetailpage.tsx` — 学校标签/匿名/审核状态
- `src/pages/homepage/homepage.tsx` — 混合信息流 + 本校热门 + 关注动态
- `src/pages/privacysettingspage/privacysettingspage.tsx` — 隐藏主页 + 个性化开关
- `src/pages/userprofilepage/userprofilepage.tsx` — 隐藏内容展示
- `src/pages/myfavoritespage/myfavoritespage.tsx` — 收藏夹分组
- `src/pages/admin/adminpage.tsx` — 审核中心菜单
- `src/app.tsx` — 新路由（my/earnings、topic/school/:id）
- `src/pages/profilepage/profilepage.tsx` — 我的收益入口
- `index.html` — PWA manifest 链接
- `package.json` — 删除废弃 server 脚本
- 若干页面 — typecheck 清零（unused imports、类型断言）

**删除**（遗留废弃后端）
- `server/`、`api/`、`shared/`、`Dockerfile`、`vercel.json`、`netlify.toml`

---

## 四、尚未做（需人工/外部依赖）

| 项 | 说明 |
|---|---|
| 数据库迁移执行 | 需在 Supabase SQL Editor 手动执行（或 `node db/run-schema-v2.cjs` 类脚本扩展） |
| service key 重生 | Supabase Dashboard 手动操作 |
| ICP/公安备案 | 外部流程 |
| 云内容审核 API | 已留本地关键词兜底 + 架构预留 |
| 实名认证 | 需第三方服务 |
| 真实广告 SDK | adprovider 已留 pangle/gdt/adsense 接口 |


## v16 上线版（2026-08-14）

基于 v15 评审的 P0/P1/P2 修复：

| 项 | 修复内容 |
|---|---|
| 排行榜 | 按境界 RPC 查询（get_rankings_by_realm，50 名），不再前端过滤全量用户；补 stage 数据 |
| 学校统一 | profiles.school_id FK + save_my_school RPC + 提问选校自动绑定圈子 + 资料页高校库选择器 |
| 通知兜底 | TopNav/通知页 60s 轮询兜底（Realtime 断连仍刷新）；通知列表分页加载 |
| SPA fallback | README 部署注意：EdgeOne 必须配置全部路径回退 index.html（BrowserRouter 刷新 404 风险） |
| 环境/CI | .env.example 变量模板 + GitHub Actions（typecheck+build） |
| 文档 | README 全面更新（v16 功能清单/迁移顺序/SEO 流程/部署注意） |

v16 迁移：db/migrations/20260814-v16-launch.sql（排行榜 RPC + stage 修复 + school_id + create_question 同步 + save_my_school + 通知索引）


## v17 九宫格内容管理（2026-08-14）

| 项 | 内容 |
|---|---|
| 九宫格进学校管理页 | 高校管理页每行「九宫格」按钮 → 弹窗直接编辑该校九宫格（不再需要跳转独立页） |
| 每校独立配置 | 每个学校的九宫格展示文字 + 网盘链接独立存储（service_contents 高校×服务项），互不影响 |
| 文字/网盘可编辑 | 弹窗内每个服务项：展示文字 textarea + 网盘链接 input，保存全部生效 |
| 批量处理 | 批量导入（粘贴「服务项标签|内容|网盘链接」每行一条，自动匹配服务项）、导出该校（txt 下载）、一键清空 |
| 入口保留 | 弹窗底部保留「打开完整编辑页」跳转原高级页（含全校批量导入导出） |

新文件：src/components/unigriddialog.tsx（九宫格内容编辑弹窗）
改动：src/pages/admin/adminuniversitiespage.tsx（行按钮 + 弹窗接入）


## v18 九宫格整合 + 学校认证（2026-08-14）

| 项 | 内容 |
|---|---|
| 九宫格配置并入高校管理 | 原独立「九宫格配置」菜单移除；高校管理页新增「九宫格功能配置」按钮 → 弹窗管理排序/图标符号/广告解锁开关/显示隐藏开关，批量保存 |
| 付费咨询固定死 | topic_services.fixed 字段 + 数据库强制（sort_order=0/enabled=true/label 锁定）+ 弹窗内 🔒 锁定（不可删/改/隐藏/排序）+ 前端渲染永远第一 |
| 付费咨询连接认证修士 | 大学专题页付费咨询格（金色高亮+认证标识）→ 弹窗展示本校**认证修士**列表 → 点击「咨询TA」发起付费咨询 |
| 学校认证体系 | 学校圈子页「申请学校认证」（需登录）→ 后台新增「认证审核」菜单（待审核/已通过/已拒绝，可填拒绝原因）→ 通过后 profiles.school_verified=true，获得认证标识 |
| 悬赏认证标识 | 悬赏榜发布者旁显示「✓ 学校名」认证徽章 |

v18 迁移：db/migrations/20260814-v18-school-verify.sql（school_verified 字段 + school_verifications 表 + 5 个 RPC + topic_services.fixed + profiles_public 视图重建）
新文件：src/components/serviceconfigdialog.tsx、src/pages/admin/adminverificationspage.tsx


## v19 问题悬赏 + 邀请回答 + 收藏夹入口（2026-08-14）

| 项 | 内容 |
|---|---|
| 问题学校标签 | 问题卡片显示学校标签（模块级缓存一次查询全站复用），点击进学校圈子 |
| 提问页悬赏 | 提问时可选设置悬赏金额（1-100 元，余额支付），发布同时挂到悬赏榜 |
| 追加悬赏 | 问题详情页提问者专属「追加悬赏」（响应慢催更）；无悬赏时自动首次挂赏 |
| 选校确认推送 | 提问选校后出现「优先推送给本校认证修士？」开关，发布后批量邀请该校认证修士（写 invites + 通知） |
| 邀请回答 | 问题详情/我的提问页「邀请回答」弹窗：①批量邀请本校认证修士 ②搜索邀请指定用户 ③转全网悬赏 |
| 我的邀请 | 新页面 /my/invites：收到的回答邀请列表（认证修士标识），我的页入口 |
| 我的提问 | 每条问题加「邀请回答」+「悬赏」按钮 |
| 收藏夹入口 | 我的页新增「我的收藏」入口（收藏夹功能 v11 已有，补齐入口） |

v19 迁移：db/migrations/20260814-v19-invite-bounty.sql（invites 正式建表 + RLS、bounties.question_id、5 个 RPC：create_bounty_for_question / add_bounty_amount_by_question / invite_user / invite_verified_members / list_my_invites）
新文件：src/components/invitedialog.tsx、src/pages/myinvitespage/myinvitespage.tsx


## v21 私信修复 + 图片视频 + APK 打包（2026-08-14）

| 项 | 内容 |
|---|---|
| 私信布局修复 | 聊天页不再显示底部导航（避免输入栏被遮挡，发送按钮不可见）；输入栏 pb-safe 适配全面屏 |
| 私信图片/视频 | 输入栏新增图片/视频按钮 → 上传 Supabase Storage（图片压缩 5MB / 视频 100MB）→ 发送带类型消息；气泡渲染图片（点击放大）与视频（内联播放） |
| 消息类型 | private_messages.msg_type（text/image/video）+ send_private_message RPC 支持类型（旧调用完全兼容） |
| APK | Capacitor 集成（android 工程已生成）+ GitHub Actions 一键构建 APK（push 或手动触发，产物可直接安装） |

v21 迁移：db/migrations/20260814-v20-pm-media.sql（msg_type 字段 + send_private_message RPC 扩展）
新文件：capacitor.config.ts、.github/workflows/build-apk.yml


## V23/V24 商业化平台（2026-08-14）

依据「v23 商业化平台开发规格」（17 轮 62 工单）落地核心盈利闭环，并经 10 轮大厂标准迭代测试生成 V24。

**本轮落地工单（14 个）**：
| 工单 | 内容 |
|---|---|
| IT-201 | 用户角色（user/creator/merchant/platform）+ wallets（灵石/冻结现金）+ 注册即建钱包触发器 + 存量补建 |
| IT-203 | config 全局配置中心（广告开关/展板位价/费率），前端热读缓存 |
| IT-204 | analytics_events 统一埋点（广告/展板/购买事件） |
| IT-205 | ad_slots 广告位模型（splash/feed/reward/banner + 频控） |
| IT-208 | 激励视频发灵石（reward_watch_ad，每日上限 30 次防刷） |
| IT-225/227 | merchants 商家表 + campuses 校区维度 |
| IT-226/228 | 商家入驻 RPC（自动初审）+ 商家角色 + RLS 数据隔离 + 后台审核 |
| IT-229 | 学校圈子页展板/商家区块（学生视角） |
| IT-230 | ad_boards 私域广告展板（官方位优先，曝光/点击埋点去重） |
| IT-232 | buy_board_slot 商家购买展位（周/月/季计价，余额支付，平台收展位费） |
| IT-231 | ad_pushes 平台向商家定向推送（校区/类目/渠道） |
| IT-251/253 | 后台「广告平台」管理台（展板管理/商家审核/私域推送） |

**10 轮迭代测试**（详见 V24-10轮测试报告.md）：74/74 检查项全绿、循环 chunk 消除（vendor 单包）、生产依赖 0 漏洞、全站 JS gzip 490KB。

**遗留**：规格剩余 48 工单（会员/道具/核销/数据API/社群/周边/裂变/合规冲刺）留待后续轮次。


## V25 失物招领 + 悬赏物品/跑腿 + 校花校草评选（2026-08-14）

安全模式：平台不托管用户间资金，仅收置顶费/投票费/发布服务费（余额扣款，与打赏分离）。

| 功能 | 内容 | 变现 |
|---|---|---|
| 失物招领 | /lost 页面：拾到（免费）+ 寻物（免费）+ 分类/地点/图片/联系方式 + 置顶优先排序 + 已解决标记 | 置顶 ¥1/天（余额，平台收入） |
| 悬赏物品/跑腿 | 悬赏榜类型 tab（问答/物品/跑腿服务）；物品求购、二手、代取快递等；发布收 5% 服务费（最低 1 元） | 发布服务费 5% |
| 校花校草评选 | /beauty 页面：活动切换、报名（需本校认证修士）、排行榜、投票（免费 1 票 + 付费加票 ¥1=10 权重）；后台「评选管理」（创建活动/候选审核） | 付费加票 |

v25 迁移：db/migrations/20260814-v25-features.sql（lost_items + 3 RPC、bounties 扩展 + 2 RPC、beauty 3 表 + 3 RPC，全部幂等 + RLS）
新页面：src/pages/lostfoundpage、src/pages/beautycontestpage、src/pages/admin/adminbeautypage
新 API：src/lib/features.ts
首页新增「失物招领」「校花校草评选」入口卡片


## V26 表白墙 + 白屏修复（2026-08-14）

**表白墙（/wall）**：免费发布（默认匿名）→ 置顶 ¥2/天 → 精选 ¥5/天（墙顶 banner，审核通过后可精选）；点赞（复用 likes 表）；内容自动审核（命中敏感词隐藏入复核队列）。
变现：置顶费/精选费（余额支付，平台收入，与打赏分离）。

**白屏修复**：
- 根因：产物资源为绝对路径 /assets（根域部署正常，但 file:// 直接打开或子路径部署会 404 白屏）
- 加固：全局 JS 错误捕获 + 白屏检测（5 秒 root 为空 → 清 SW 缓存自动刷新，30 秒内不循环）+ 错误边界恢复页（一键清缓存重载）+ SW 缓存名更新 v22→v25
- 部署说明：必须用服务器/域名访问，不支持 file:// 直接打开

v26 迁移：db/migrations/20260814-v26-confession.sql（confessions 表 + 5 RPC：create/pin/feature/toggle_like/list，幂等 + RLS + 自动审核）
新页面：src/pages/confessionwallpage、首页表白墙入口

## V27 九宫格广告独立化 + 后台管理 + 评选周期榜（2026-08-14）

| 项 | 内容 |
|---|---|
| 九宫格配置精简 | 功能配置弹窗不再含网盘链接/看广告开关（上轮已做） |
| 每校独立广告开关 | service_contents.ad_unlock：每所学校每个服务项独立设置「需要看广告」；前台内容页按该校开关显示「看广告解锁」或「直接打开」；存量数据自动同步旧全局开关 |
| 后台社区管理 | 新菜单「社区管理」：失物/寻物（筛选+下架）+ 悬赏/跑腿（类型筛选+关闭） |
| 评选周期榜单 | 评选管理活动详情：本月/本季/本年/全部 四档榜单（get_beauty_ranking_by_period RPC） |

v27 迁移：db/migrations/20260814-v27-admin.sql（service_contents.ad_unlock + 存量同步 + 4 个管理 RPC + 周期榜单 RPC）
