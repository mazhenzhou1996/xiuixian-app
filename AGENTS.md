# 修仙问答社区 - 需求拆解文档

> **附件说明**: 用户提供了 13 个附件链接，但全部返回非图片内容（HTML/JS），无法在本阶段直接读取内容。已将附件信息记录在案，待下游 design-agent 阶段使用 screenshot 工具进一步分析。当前需求拆解以用户文字描述为准。

## 产品概述

- **产品类型**: 修仙主题问答社区（移动端优先 Web 应用）
- **场景类型**: <scene_type>prototype-app</scene_type>
- **目标用户**: 修仙文化爱好者、网文读者、喜欢玄幻题材的问答社区用户
- **核心价值**: 以修仙境界体系为特色的问答社区，用户围绕修仙话题提问、回答、交流，通过境界排行体系营造社区氛围
- **界面语言**: 中文
- **主题偏好**: user_specified（金色主色调 #d4af37 + 浅灰背景 #f5f7fa + 白色卡片，修仙古风调性）
- **导航模式**: 路径导航（JS 切换页面内容，模拟多页面体验的单页应用）
- **导航布局**: 移动端双导航结构——顶部 Tab 导航（推荐/热榜/排行榜/搜索）+ 底部 Tab 导航（消息/提问/主页）

---

## 页面结构总览

> **说明**: 这是一个纯前端单页应用（SPA 模拟），通过 JS 切换页面内容。以下为全部页面，含一级和二级页面。总页面数 12 个（用户明确要求）。

| 页面名称 | 路由标识 | 页面类型 | 入口来源 | 简要说明 |
|---------|---------|---------|---------|---------|
| 首页（推荐信息流） | `#/home` | 一级 | 顶部导航 | 问答卡片列表，推荐信息流 |
| 热榜页面 | `#/hot` | 一级 | 顶部导航 | 实时热榜，热度排序，前三名特殊样式 |
| 排行榜页面 | `#/rank` | 一级 | 顶部导航 | 修仙境界排行榜，5 个境界榜单 |
| 搜索页面 | `#/search` | 一级 | 顶部导航 | 本站搜索 + AI 搜索，模型选择 |
| 登录页面 | `#/login` | 二级 | 个人主页（未登录时）/ 需登录操作触发 | 手机号/账号 + 密码登录 |
| 注册页面 | `#/register` | 二级 | 登录页 → 注册链接 | 手机号 + 昵称 + 密码注册 |
| 提问页面 | `#/ask` | 一级 | 底部导航（提问按钮） | 普通/付费提问，支持图片视频上传，历史提问 |
| 问题详情页面 | `#/question/:id` | 二级 | 首页/热榜/搜索 → 点击问题卡片 | 问题内容 + 回答列表 + 点赞/评论/收藏/关注 |
| 评论区页面 | `#/comments/:answerId` | 二级 | 问题详情页 → 点击评论入口 | 评论 + 回复列表，发送/点赞/回复 |
| 消息页面 | `#/messages` | 一级 | 底部导航（消息按钮） | 消息分类（全部/评论/点赞/收藏/关注/官方），一键已读 |
| 个人主页 | `#/profile` | 一级 | 底部导航（主页按钮） | 用户信息 + 我的提问/回答/收藏 + 退出登录 |
| 回答编辑页面 | `#/answer/:questionId` | 二级 | 问题详情页 → 写回答按钮 | 撰写回答，富文本工具栏（图/视频/文件/链接/分割线） |

> **页面类型说明**：
> - **一级页面（共 6 个）**：首页、热榜、排行榜、搜索、提问、消息、个人主页 — 出现在顶部或底部导航中
> - **二级页面（共 6 个）**：登录、注册、问题详情、评论区、回答编辑 — 通过页面内操作进入

---

## 页面布局建议

### 全局布局（所有页面共享）

- **布局模式**: 移动端单栏布局，最大宽度 720px 居中
- **导航结构**: 顶部固定导航栏（4 个 Tab：推荐/热榜/排行榜/搜索） + 底部固定导航栏（3 个 Tab + 中间提问按钮：消息/提问/主页）
- **内容区域**: 顶部导航下方、底部导航上方，留出 safe area

### 首页 / 热榜 / 搜索结果页

- **布局模式**: 单栏垂直列表
- **视觉重心**: 内容列表（问答卡片）
- **结果承载区**: 问答卡片列表流；初始态为骨架屏 / 加载后渲染卡片
- **每页卡片结构**: 头像 + 昵称 + 境界标识 + 问题标题 + 问题摘要 + 图片（可选）+ 底部互动栏（点赞数/评论数/收藏按钮）

### 排行榜页面

- **布局模式**: 顶部 Tab 切换（5 个境界） + 榜单列表
- **视觉重心**: 榜单排名
- **前三名特殊样式**: 金色/银色/铜色奖牌图标 + 高亮背景 + 放大头像

### 提问页面 / 回答编辑页面

- **布局模式**: 单栏表单布局，顶部标题 + 正文输入区 + 底部操作栏
- **视觉重心**: 正文编辑区
- **工具栏**: 图片/视频/文件/链接/分割线等操作按钮一行排列
- **结果承载区**: 实时预览或历史提问列表（提问页）

---

## 插件规划

| 插件实例名称 | 基于官方插件 | 业务用途 | 输出模式 | 所属页面 |
|------------|-----------|---------|---------|---------|
| AI 搜索回答 | `ai-search-summary` | 在搜索页提供 AI 搜索功能，根据用户查询生成总结回答 | stream | 搜索页面 |

> 🔴 **说明**: 用户明确要求"支持本站搜索和AI搜索，有模型选择下拉"，其中 AI 搜索属于 real-plugin 能力。模型选择下拉作为前端 UI 交互项，对应不同的搜索策略/模型参数。

---

## 导航配置

### 顶部导航栏

- **导航布局**: Topbar（顶部固定，移动端适配）
- **导航项**:
  | 导航文字 | 路由标识 | 说明 |
  |---------|---------|------|
  | 推荐 | `#/home` | 推荐信息流首页 |
  | 热榜 | `#/hot` | 实时热榜 |
  | 排行榜 | `#/rank` | 修仙境界排行榜 |
  | 搜索 | `#/search` | 搜索页面 |

### 底部导航栏

- **导航布局**: Bottom Tab Bar（底部固定，移动端适配）
- **导航项**:
  | 导航文字 | 路由标识 | 图标类型 | 说明 |
  |---------|---------|---------|------|
  | 消息 | `#/messages` | Message | 左侧 Tab，未读红点提示 |
  | 提问 | `#/ask` | Plus / 提问按钮（中间突出） | 中间主操作按钮，突出样式 |
  | 主页 | `#/profile` | User | 右侧 Tab，个人主页 |

---

## 数据来源声明

| 数据/操作 | 来源类型 | 实现要求 | mock 兜底 |
|---|---|---|---|
| 用户数据（注册/登录/个人信息） | local-persist | localStorage key=`__xiuxian_users`，存储用户列表；当前登录用户 key=`__xiuxian_currentUser` | 初始预置 3-5 个示例用户（含不同境界），source='mock' |
| 问题数据 | local-persist | localStorage key=`__xiuxian_questions`，存储所有问题 | 初始预置 10-15 条示例问题，source='mock' |
| 回答数据 | local-persist | localStorage key=`__xiuxian_answers`，存储所有回答 | 初始预置多条示例回答，source='mock' |
| 评论数据 | local-persist | localStorage key=`__xiuxian_comments`，存储所有评论/回复 | 初始预置示例评论，source='mock' |
| 收藏数据 | local-persist | localStorage key=`__xiuxian_favorites`，存储用户收藏关系 | 无（用户行为数据） |
| 关注数据 | local-persist | localStorage key=`__xiuxian_follows`，存储用户关注关系 | 无（用户行为数据） |
| 消息数据 | local-persist | localStorage key=`__xiuxian_messages`，存储系统/互动消息 | 初始预置若干示例消息，source='mock' |
| 点赞数据 | local-persist | localStorage key=`__xiuxian_likes`，存储点赞关系 | 无（用户行为数据） |
| AI 搜索 | real-plugin | capabilityClient 调 ai-search-summary 实例，传入用户搜索关键词和选中的模型参数，流式输出 AI 搜索总结结果 | 失败提示（toast "AI 搜索暂不可用，请使用本站搜索"） |
| 本站搜索 | local-persist | 在 localStorage 问题/回答数据中做关键词匹配过滤 | 无（直接从持久化数据查询） |
| 图片/视频上传 | demo-mock | 前端使用 File API 读取文件，转为 base64/dataURL 存入 localStorage 对应内容中 | 示例内容含占位图 |

> **说明**: 这是纯前端应用，所有核心业务数据都通过 localStorage 持久化（用户明确要求"数据层使用localStorage持久化"）。AI 搜索是唯一插件能力。图片/视频上传因纯前端限制，采用 File API + base64 存入 localStorage 的模式（demo 级别）。

---

## 功能列表

### 首页（推荐信息流）
- **页面目标**: 展示问答推荐信息流，作为社区主入口
- **功能点**:
  - **问答卡片列表**: 下拉加载更多，每张卡片展示提问者头像/昵称/境界、问题标题、摘要、缩略图（可选）、点赞数、评论数
  - **推荐算法（简化版）**: 按热度 + 时间综合排序，模拟推荐效果
  - **卡片点击跳转**: 点击卡片进入问题详情页
  - **下拉刷新（模拟）**: 顶部下拉刷新列表

### 热榜页面
- **页面目标**: 展示当前最热门的问题
- **功能点**:
  - **热度排序列表**: 按热度值（综合点赞/评论/浏览量）从高到低排序
  - **前三名特殊样式**: 第 1 名金色奖牌 + 金色背景高亮，第 2 名银色，第 3 名铜色，头像放大
  - **热度标签**: 每条显示热度数值和"热"、"沸"、"新"等标签

### 排行榜页面
- **页面目标**: 展示修仙境界用户排行榜
- **功能点**:
  - **境界 Tab 切换**: 顶部 5 个 Tab（化神境/元婴境/结丹境/筑基境/练气境），点击切换榜单
  - **榜单列表**: 展示排名、头像、昵称、境界徽章、积分/声望值
  - **前三名特殊样式**: 金/银/铜奖牌图标 + 高亮行背景
  - **用户头像点击**: 可跳转到该用户的主页（同个人主页结构，展示他人信息）

### 搜索页面
- **页面目标**: 提供站内搜索和 AI 搜索能力
- **功能点**:
  - **搜索输入框**: 顶部搜索框，支持回车搜索，历史搜索记录展示
  - **搜索类型切换**: Tab 切换"本站搜索"和"AI 搜索"
  - **模型选择下拉**: AI 搜索模式下展示模型选择下拉框
  - **本站搜索结果**: 匹配问题标题和内容，展示结果列表
  - **AI 搜索结果（流式）**: 调用 AI 搜索插件，流式输出总结回答，下方附相关问题引用
  - **搜索历史**: localStorage 保存搜索历史，支持清空

### 登录页面
- **页面目标**: 用户登录，建立会话
- **功能点**:
  - **登录表单**: 手机号/账号输入框 + 密码输入框 + 登录按钮
  - **表单校验**: 手机号格式校验、密码长度校验
  - **登录验证**: 从 localStorage 用户数据中匹配账号密码
  - **注册入口**: "没有账号？去注册"链接跳转到注册页
  - **登录状态保持**: 登录成功后写入 `__xiuxian_currentUser`

### 注册页面
- **页面目标**: 新用户注册
- **功能点**:
  - **注册表单**: 手机号 + 昵称 + 密码 + 确认密码
  - **表单校验**: 手机号格式、昵称非空、密码长度、两次密码一致
  - **账号去重**: 检查手机号是否已注册
  - **注册成功**: 写入 localStorage 用户列表，自动登录并跳转首页
  - **登录入口**: "已有账号？去登录"链接

### 提问页面
- **页面目标**: 用户发布新问题
- **功能点**:
  - **提问类型切换**: Tab 切换"普通提问"和"付费提问"
  - **问题标题输入**: 标题输入框，字数限制提示
  - **问题详情编辑**: 多行文本编辑区
  - **图片/视频上传**: 上传按钮，支持选择本地图片/视频，前端预览（File API）
  - **历史提问列表**: 下方展示当前用户的历史提问记录
  - **发布提交**: 提交后写入 localStorage 问题列表，跳转问题详情页

### 问题详情页面
- **页面目标**: 展示问题详情和回答列表
- **功能点**:
  - **问题头部信息**: 提问者头像/昵称/境界、问题标题、问题正文、发布时间、浏览数
  - **关注按钮**: 关注/取消关注提问者
  - **收藏按钮**: 收藏/取消收藏问题，状态实时切换
  - **回答列表**: 按点赞数排序展示回答，每条回答含答主信息、回答内容、点赞按钮、评论入口
  - **回答点赞**: 点赞/取消点赞，计数实时更新
  - **写回答入口**: 底部固定"写回答"按钮，跳转回答编辑页
  - **评论入口**: 点击回答的评论按钮进入评论区页面

### 评论区页面
- **页面目标**: 展示和管理评论及回复
- **功能点**:
  - **评论列表**: 展示该回答下的所有评论，含评论者信息、内容、时间、点赞数
  - **回复展示**: 评论下方展示回复列表（最多展示 2 条，更多展开）
  - **发表评论**: 底部输入框 + 发送按钮，提交后即时显示
  - **回复评论**: 点击"回复"按钮，输入框变为回复模式（@某人）
  - **评论点赞**: 点赞/取消点赞

### 消息页面
- **页面目标**: 集中展示各类消息通知
- **功能点**:
  - **消息分类 Tab**: 顶部横向滚动 Tab（全部/评论/点赞/收藏/关注/官方）
  - **消息列表**: 按分类展示消息，未读消息红点标记
  - **一键已读**: 右上角"全部已读"按钮，点击后所有消息标记为已读
  - **消息点击跳转**: 点击消息跳转到对应的问题详情/用户主页等
  - **未读数角标**: 底部导航消息图标显示未读总数角标

### 个人主页
- **页面目标**: 展示用户信息和个人内容管理
- **功能点**:
  - **用户信息卡片**: 头像、昵称、境界徽章、积分、声望、关注数/粉丝数
  - **内容分类 Tab**: 我的提问 / 我的回答 / 我的收藏
  - **列表展示**: 对应分类下的内容列表，点击进入详情
  - **退出登录**: 退出按钮，清除当前登录状态，跳转首页
  - **未登录态**: 未登录时展示登录/注册按钮引导

### 回答编辑页面
- **页面目标**: 撰写并提交回答
- **功能点**:
  - **问题上下文**: 顶部展示正在回答的问题标题和摘要
  - **回答编辑区**: 多行文本输入框
  - **富文本工具栏**: 图片上传、视频上传、文件上传、插入链接、插入分割线（按钮式工具栏）
  - **字数统计**: 实时显示已输入字数
  - **提交回答**: 提交后写入 localStorage 回答列表，返回问题详情页
  - **草稿保存**: 自动保存草稿到 localStorage，防止丢失

---

## 数据共享配置

> **说明**: 所有数据通过 localStorage 持久化，页面间通过读取同一 localStorage key 共享数据。以下为核心数据结构定义。

| 存储键名 | 数据说明 | 使用页面 |
|---------|---------|---------|
| `__xiuxian_users` | 用户列表，类型 `IUser[]` | 登录、注册、个人主页、问题详情、排行榜 |
| `__xiuxian_currentUser` | 当前登录用户 ID，类型 `string` | 所有页面（鉴权用） |
| `__xiuxian_questions` | 问题列表，类型 `IQuestion[]` | 首页、热榜、搜索、提问页、问题详情、个人主页 |
| `__xiuxian_answers` | 回答列表，类型 `IAnswer[]` | 问题详情、回答编辑页、个人主页 |
| `__xiuxian_comments` | 评论列表，类型 `IComment[]` | 评论区页面、问题详情 |
| `__xiuxian_favorites` | 收藏关系，类型 `IFavorite[]` | 问题详情、个人主页 |
| `__xiuxian_follows` | 关注关系，类型 `IFollow[]` | 问题详情、个人主页、消息 |
| `__xiuxian_likes` | 点赞关系，类型 `ILike[]` | 问题详情、评论区、个人主页 |
| `__xiuxian_messages` | 消息列表，类型 `IMessage[]` | 消息页面 |
| `__xiuxian_searchHistory` | 搜索历史，类型 `string[]` | 搜索页面 |
| `__xiuxian_answerDraft` | 回答草稿，类型 `{questionId, content}` | 回答编辑页面 |

### TypeScript 接口定义

```ts
/**
 * 修仙境界枚举
 */
type RealmLevel = 'huashen' | 'yuanying' | 'jiedan' | 'zhuji' | 'lianqi';

/**
 * 用户数据结构
 */
interface IUser {
  id: string;
  phone: string;          // 手机号
  nickname: string;       // 昵称
  password: string;       // 密码（明文，demo 用）
  avatar: string;         // 头像 URL
  realm: RealmLevel;      // 修仙境界
  points: number;         // 积分/声望
  bio?: string;           // 个人简介
  createdAt: number;      // 注册时间戳
  source?: 'mock' | 'user'; // 数据来源
}

/**
 * 问题数据结构
 */
interface IQuestion {
  id: string;
  userId: string;         // 提问者 ID
  title: string;          // 问题标题
  content: string;        // 问题详情
  images?: string[];      // 图片列表（base64 或 URL）
  type: 'normal' | 'paid';// 普通/付费提问
  viewCount: number;      // 浏览数
  answerCount: number;    // 回答数
  likeCount: number;      // 点赞数
  favoriteCount: number;  // 收藏数
  hotScore: number;       // 热度分数
  createdAt: number;      // 发布时间戳
  source?: 'mock' | 'user';
}

/**
 * 回答数据结构
 */
interface IAnswer {
  id: string;
  questionId: string;     // 所属问题 ID
  userId: string;         // 回答者 ID
  content: string;        // 回答内容
  images?: string[];      // 图片
  likeCount: number;      // 点赞数
  commentCount: number;   // 评论数
  createdAt: number;      // 发布时间戳
  source?: 'mock' | 'user';
}

/**
 * 评论数据结构
 */
interface IComment {
  id: string;
  answerId: string;       // 所属回答 ID
  userId: string;         // 评论者 ID
  content: string;        // 评论内容
  replyTo?: string;       // 回复目标评论 ID（根评论为 undefined）
  replyToUserId?: string; // 回复目标用户 ID
  likeCount: number;      // 点赞数
  createdAt: number;      // 发布时间戳
  source?: 'mock' | 'user';
}

/**
 * 收藏关系
 */
interface IFavorite {
  id: string;
  userId: string;
  questionId: string;
  createdAt: number;
}

/**
 * 关注关系
 */
interface IFollow {
  id: string;
  followerId: string;     // 关注者
  followingId: string;    // 被关注者
  createdAt: number;
}

/**
 * 点赞关系
 */
interface ILike {
  id: string;
  userId: string;
  targetType: 'question' | 'answer' | 'comment';
  targetId: string;
  createdAt: number;
}

/**
 * 消息数据结构
 */
interface IMessage {
  id: string;
  userId: string;         // 接收用户 ID
  type: 'comment' | 'like' | 'favorite' | 'follow' | 'official';
  title: string;          // 消息标题
  content: string;        // 消息内容
  fromUserId?: string;    // 触发者用户 ID
  targetType?: string;    // 关联目标类型
  targetId?: string;      // 关联目标 ID
  isRead: boolean;        // 是否已读
  createdAt: number;      // 创建时间
  source?: 'mock' | 'system';
}
```

---

## 设计风格约束

| 设计项 | 规范值 | 说明 |
|-------|-------|------|
| 主色调 | `#d4af37`（金色） | 品牌色，用于导航激活态、按钮、强调元素 |
| 背景色 | `#f5f7fa`（浅灰） | 页面背景 |
| 卡片背景 | `#ffffff`（白色） | 内容卡片、列表项 |
| 文字主色 | `#333333` | 标题、正文 |
| 文字次色 | `#999999` | 辅助信息、时间、计数 |
| 最大宽度 | `720px` | 内容容器 max-width，居中显示 |
| 适配优先 | 移动端优先 | 以手机尺寸为基准设计，兼容桌面端居中展示 |
| 导航位置 | 顶部 + 底部固定 | 顶部 Tab 4 个，底部 Tab 3 个（中间提问按钮突出） |
| 修仙元素 | 境界徽章、祥云纹、古风字体感觉 | 视觉点缀，不喧宾夺主 |

-------

<scene_type>prototype-app</scene_type>

# UI 设计指南

## 1. 设计推导依据

- **参考意图**: Free Direction —— 附件无法解析，设计基于需求描述与修仙问答社区语义自主构建
- **核心情绪 / 应用类型**: 古典修仙意象包裹的现代问答社区，移动端优先的信息流产品
- **独特记忆点**: 金色主色 + 修仙境界体系贯穿全站（练气/筑基/结丹/元婴/化神），用户等级与榜单以境界命名，形成强主题识别

## 2. Art Direction

- **方向名**: 仙韵金简
- **Design Style**: Modern Chinese + Soft Rounded —— 用金色与浅灰构建典雅质感，圆润卡片保持现代移动端亲和力
- **DNA 参数**: 圆角 `rounded-xl`（卡片）/ `rounded-full`（按钮、头像）；阴影 `shadow-sm`（默认）/ `shadow-md`（悬浮）；间距标准（`gap-4` / `p-4`）；字体方向：正文无衬线清晰可读，标题略带古典气质；装饰手法：金色细线、祥云纹样点缀、境界徽章
- **应用类型**: Info Feed —— 上下固定导航 + 中间信息流滚动

## 3. Color System

**色彩关系**: 金色主色 + 同色系极浅金反馈底 + 冷调浅灰背景 + 纯白卡片，形成"仙卷展开"的视觉层次
**配色设计理由**: 金色 `#d4af37` 对应修仙文化中的金丹、仙气、尊贵，承担品牌识别与主交互；浅灰背景降低阅读疲劳；白色卡片承载问答内容保证可读性；accent 用极浅金承接 hover/选中状态，与主色同色系不割裂
**主色推导**: 从需求指定的金色 `#d4af37`（hsl(46 74% 52%)）出发，降低明度得 hover 态，提高明度降饱和度得 accent 浅底，与中性灰搭配形成完整系统
**使用比例**: 65% 中性（bg + card + text 家族）/ 28% 辅助（accent + border）/ 7% primary（金色只用于 CTA、境界徽章、热榜高亮、关注态），严禁金色铺满 tab、图标、边框、链接

| 角色 | CSS 变量 | Tailwind Class | HSL 值 | 设计说明 |
|---|---|---|---|---|
| bg | `--background` | `bg-background` | hsl(214 32% 97%) | 页面背景浅灰 #f5f7fa |
| card | `--card` | `bg-card` | hsl(0 0% 100%) | 卡片白色背景 |
| text | `--foreground` | `text-foreground` | hsl(222 20% 16%) | 标题与正文深灰 |
| textMuted | `--muted-foreground` | `text-muted-foreground` | hsl(215 14% 55%) | 辅助信息、时间、元数据 |
| primary | `--primary` | `bg-primary` / `text-primary` | hsl(46 74% 52%) | 金色主色 #d4af37，CTA 与品牌锚点 |
| primaryForeground | `--primary-foreground` | `text-primary-foreground` | hsl(40 30% 12%) | 金色上的深棕文字，保证对比 |
| accent | `--accent` | `bg-accent` | hsl(46 70% 94%) | 浅金底，hover/选中/骨架屏 |
| accentForeground | `--accent-foreground` | `text-accent-foreground` | hsl(46 60% 35%) | accent 上的文字图标 |
| border | `--border` | `border-border` | hsl(214 20% 90%) | 卡片边界、分隔线、输入框 |

**语义色提示**: 成功 hsl(142 55% 45%) —— bg: hsl(142 55% 95%) / border: hsl(142 50% 80%) / text: hsl(142 55% 35%)；警告 hsl(32 90% 55%) —— bg: hsl(32 90% 95%) / border: hsl(32 85% 75%) / text: hsl(32 80% 40%)；错误 hsl(0 75% 55%) —— bg: hsl(0 75% 96%) / border: hsl(0 70% 80%) / text: hsl(0 70% 42%)。语义色饱和度与 primary 对齐，避免状态色压过品牌色

## 4. 字体与节奏

- **font-display**: Noto Serif SC —— 古典衬线气质，用于页面标题、境界名称、热榜名次，呼应修仙文化
- **font-body**: Noto Sans SC —— 清晰现代无衬线，用于问答正文、评论、导航，保证移动端阅读效率
- **字号**: H1 text-xl ~ text-2xl（移动端）；H2 text-lg；body text-base；muted text-sm / text-xs
- **圆角**: 中 —— 卡片 `rounded-xl`，按钮 `rounded-full`，输入框 `rounded-lg`，兼顾古典圆润与现代清洁

## 5. 全局布局契约

- **Reference Layout Use**: 按需求结构推导，顶部 tab + 底部 tab bar + 中间内容区的经典移动端问答社区结构
- **Page / Section Order**: 首页 / 热榜 / 排行榜 / 搜索 / 登录 / 注册 / 提问 / 问题详情 / 评论区 / 消息 / 个人主页 / 回答编辑，共 12 个页面
- **Standard Content Zone**: `max-w-[720px]` + `mx-auto`，移动端优先，桌面端居中显示同宽度
- **Shell / Frame Alignment**: 顶部导航与底部导航固定（`fixed top-0` / `fixed bottom-0`），内容区 `pt-14 pb-16` 避让，内容宽度与导航同宽约束于 720px 内
- **Padding & Rhythm**: `px-4 py-3`，卡片间距 `gap-3`，保持 4px 倍数节奏适配移动端密度
- **Full-bleed Zones**: 顶底导航栏全宽显示，内部内容受 720px 约束居中
- **Local Narrowing**: 登录、注册、提问、回答编辑页面表单内容可在 720px 容器内进一步收窄至 `max-w-md`
- **Overflow Strategy**: 横向 tab 栏（消息分类、境界榜单）使用 `overflow-x-auto` 滚动
- **Flexibility Boundary**: 允许移动端卡片内边距和间距微调；不允许改变 720px 最大宽度、金色主色、圆角系统、顶底固定导航结构

## 6. 视觉与动效

- **装饰**: 金色细线分隔、祥云/云纹极简点缀（SVG 描边）、境界徽章（圆形渐变金底 + 境界文字）
- **阴影/边界**: 轻 —— 卡片 `shadow-sm`，悬浮态 `shadow-md`，边框 `border border-border`
- **动效**: 克制 —— 页面切换用 200ms opacity + 轻微 translateY；点赞/收藏按钮有 150ms scale 反馈；骨架屏用 accent 色渐变脉冲

## 7. 组件原则

- 按钮：主按钮金底深字 `rounded-full`；次按钮白底金边框；幽灵按钮文字金
- 卡片：统一 `bg-card rounded-xl shadow-sm border border-border`，内边距 `p-4`
- 境界徽章：化神（深金渐变）/ 元婴（紫金色）/ 结丹（青金色）/ 筑基（蓝金色）/ 练气（银灰色），均为圆形小徽章 + 文字标签
- 热榜前三名：第 1 名大号金色奖章 + 金色背景条；第 2/3 名银/铜色调 + 特殊排名标识
- 所有交互元素必须有 Default / Hover / Active / Focus-visible / Disabled 五态

## 8. Image Direction

- **Image Role**: 头像占位图、境界徽章图形、空状态插画、封面装饰元素
- **Image Art Direction**: 东方仙侠极简风格，云气、仙鹤、剑、丹药等元素做极简线条化处理；金色为主色调，浅灰底；构图简洁居中，适合做头像、徽章和空状态插图；材质感为宣纸 + 金线描边
- **Image Prompt Keywords**: 仙侠极简线条、金色云纹、宣纸质感、金线描边、东方美学、圆形徽章、水墨留白、仙鹤剪影、丹药纹样、剑形符号
- **Image Avoidance**: 避免写实人物、3D 渲染、花哨的游戏 UI 风格、高饱和艳色、复杂场景插画、日式动漫风、通用素材图库感

## 9. Anti-patterns

- **Split personality**: 页面之间切换主色、圆角或阴影语言；全站共享同一套金色 + 浅灰 + 白卡视觉系统
- **Gold everywhere**: 金色铺满按钮、tab、icon、边框、链接、标题；按 7% 比例把 primary 收回到 CTA、境界徽章和热榜高亮，其余用 accent / 中性色
- **Default SaaS drift**: 回到默认蓝按钮、通用卡片堆叠；用修仙境界体系和金色系统塑造主题识别
- **Invisible interaction**: hover、active 做了，focus-visible 丢了；每个可交互元素都要有键盘可见状态（金色外轮廓）
- **Status color drift**: 成功/警告/错误饱和度远高于主色，主色克制而状态色刺眼；语义色饱和度与 primary 对齐 ±15%
- **Mobile overstuffing**: 移动端单屏塞太多信息；信息流卡片保持适中密度，上下留白充足，顶底导航不超过 5 个入口