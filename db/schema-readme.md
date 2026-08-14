# 数据库文档（Supabase）

项目 ref: `nwxtyxjborhrbesssopg`（新加坡池化直连: aws-0-ap-southeast-1.pooler.supabase.com:5432）
完整建表 SQL 见 `db/supabase-schema.sql`，自动建表脚本 `db/run-schema-v2.cjs`。

## 表结构

| 表 | 字段 | 说明 |
|---|---|---|
| profiles | id(UUID,PK,auth.users), phone, nickname, avatar, realm, points, bio, created_at | 用户资料；realm: huashen/yuanying/jiedan/zhuji/lianqi |
| questions | id(serial,PK), user_id(UUID), title, content, type, view_count, hot_score, like_count, created_at | 问题；type: normal/paid |
| answers | id(serial,PK), question_id, user_id, content, like_count, comment_count, created_at | 回答 |
| comments | id(serial,PK), answer_id, user_id, content, reply_to(text), reply_to_user_id(UUID), like_count, created_at | 评论；reply_to 存父评论 id 字符串 |
| likes | id(serial,PK), user_id, target_type(text), target_id(int), created_at, UNIQUE(user_id,target_type,target_id) | 点赞；target_type: question/answer/comment |
| favorites | id(serial,PK), user_id, question_id, created_at, UNIQUE(user_id,question_id) | 收藏问题 |
| follows | id(serial,PK), follower_id(UUID), following_id(UUID), created_at, UNIQUE(follower_id,following_id) | 关注 |
| read_messages | id(serial,PK), user_id, message_key, UNIQUE(user_id,message_key) | 消息已读标记；message_key: follow_{id}/like_{id}/answer_{id}/invite_{id}/official_{id} |
| invites | id(serial,PK), inviter_id(UUID), invitee_id(UUID), question_id(int), created_at | 邀请回答（需用户执行过建表 SQL 才有） |

## RLS 策略

所有表启用 RLS：匿名/登录用户可读公开数据；仅本人可写（auth.uid() = user_id 等）。
详见 `db/supabase-schema.sql` 中 CREATE POLICY 部分。

## RPC 函数（SECURITY DEFINER）

| 函数 | 作用 |
|---|---|
| increment_view_count(qid) | 浏览数 +1 |
| toggle_like(t_type, t_id) | 切换点赞并更新计数（返回 bool） |
| toggle_favorite(q_id) | 切换收藏（返回 bool） |
| toggle_follow(f_id) | 切换关注（禁止关注自己，返回 bool） |
| add_comment(a_id, c_text, r_to, r_to_uid) | 添加评论并更新 comment_count |
| mark_messages_read() | 把所有消息标记已读 |
| handle_new_user() | auth.users 注册触发器，自动建 profile |

## 消息（前端动态拼装）

消息不是表，由 api.getMessages() 实时查询生成：
- 官方消息: 前端内置 2 条公告（official_1/official_2）
- 关注: follows where following_id = me
- 点赞: likes(target_type=answer) where 回答属于我
- 回答: answers where 问题属于我
- 邀请: invites where invitee_id = me

## 数据备份

`db/backup-data.cjs` 用 service key 全量导出 9 张表到 `db/backup/supabase-backup-YYYY-MM-DD.json`。
最新备份: `db/backup/supabase-backup-2026-08-12.json`（profiles 5 / questions 13 / answers 7 / comments 1 / likes 8 / favorites 2 / follows 3 / read_messages 7 / invites 0）

## 种子/维护脚本

| 脚本 | 用途 | 连接方式 |
|---|---|---|
| run-schema-v2.cjs | 建表+RLS+RPC | pg 直连（密码在脚本内） |
| seed-supabase.cjs | 初始种子数据 | service key REST |
| seed-messages.cjs | 演示消息（关注/点赞/回答） | service key REST |
| seed-questions-extra.cjs | 专题演示问题 | service key REST |
| seed-real-answer.cjs | 渡劫问题真实回答 | service key REST |
| init-invites.cjs | invites 表+演示邀请 | pg 直连 |
| backup-data.cjs | 全量备份 | service key REST |

## 凭据注意

- `.env` 中 SUPABASE_DB_PASSWORD 可能是掩码占位符；真实 DB 密码在 `db/run-schema-v2.cjs` 的 PASSWORD 常量（11 位）
- anon key 可公开（前端使用）；service key 仅服务端脚本使用，勿提交公开仓库
