-- 种子数据
-- 密码统一为 123456 (bcrypt hash)
INSERT INTO users (phone, nickname, password, avatar, realm, points, bio) VALUES
('13800138001', '道友甲', '$2a$10$N9qo8uLOickgxSn4grChSe1WLQqoVpQkQjW9mIjV6mNJQ0J7qRIlu', '', 'huashen', 50, '修仙问道，不忘初心'),
('13800138002', '文史爱好者', '$2a$10$N9qo8uLOickgxSn4grChSe1WLQqoVpQkQjW9mIjV6mNJQ0J7qRIlu', '', 'yuanying', 30, '热爱分享，交流学习'),
('13800138003', '升学规划君', '$2a$10$N9qo8uLOickgxSn4grChSe1WLQqoVpQkQjW9mIjV6mNJQ0J7qRIlu', '', 'jiedan', 80, '专注升学规划与职业发展'),
('13800138004', '我爱巧克力', '$2a$10$N9qo8uLOickgxSn4grChSe1WLQqoVpQkQjW9mIjV6mNJQ0J7qRIlu', '', 'zhuji', 120, '航海家，禾果妈妈暖心说'),
('13800138005', '新道友', '$2a$10$N9qo8uLOickgxSn4grChSe1WLQqoVpQkQjW9mIjV6mNJQ0J7qRIlu', '', 'lianqi', 0, '初入修仙，请多指教')
ON CONFLICT (phone) DO NOTHING;

INSERT INTO questions (user_id, title, content, type, view_count, hot_score) VALUES
(1, '筑基期应该如何选择功法？', '刚突破练气期进入筑基，面对众多功法不知如何选择。是优先考虑攻击型还是防御型？有没有道友分享一下经验？', 'normal', 1520, 8500),
(2, '修仙世界里，散修和有宗门的修士差距到底有多大？', '最近在研究修仙世界观，发现散修和有宗门的修士之间似乎存在着巨大的鸿沟。散修没有资源、没有功法，甚至连修炼的地方都很难找到……', 'normal', 2300, 12000),
(3, '元婴期突破化神需要做什么准备？', '卡在元婴圆满已经三年了，每次冲击化神都差一口气。求各位前辈指点，突破化神的心得体会。', 'paid', 980, 4500),
(4, '心魔劫到底怎么过？', '第三次渡心魔劫又失败了，每次都在最后关头功亏一篑。有没有渡过心魔劫的道友分享一下心得？', 'normal', 3100, 15800),
(1, '灵根资质对修炼速度影响有多大？', '五行灵根、异灵根、天灵根之间差异到底有多大？劣灵根真的没有逆袭的可能吗？', 'normal', 890, 3200)
ON CONFLICT DO NOTHING;

INSERT INTO answers (question_id, user_id, content, like_count, comment_count) VALUES
(1, 2, '建议筑基期先修炼通用功法打好基础，等到了金丹期再根据自身灵根属性选择专精方向。攻击和防御都很重要，但初期建议偏向防御保命为主。', 42, 8),
(1, 3, '我当年筑基时选了《太上感应篇》，虽然攻击力不强但根基扎实。后来顺利突破金丹和元婴，深感基础的重要性。推荐道友也走稳扎稳打的路线。', 28, 5),
(2, 1, '差距确实很大。有宗门的修士每年有固定的灵石月俸、丹药配给，还有长老指点。散修全靠自己，但散修也有优势——自由，不受宗门规矩束缚。', 56, 12),
(4, 2, '心魔劫主要考验的是心性。我的经验是：第一，平时多修身养性，少造杀孽；第二，渡劫前找一处灵气充沛的清静之地；第三，准备好清心丹和定神香。最重要的是放下执念。', 89, 15),
(4, 3, '三次失败说明你的心性还有不足。建议暂时放下突破的执念，云游四方体悟人生。我当年也是在凡间游历三年后才成功渡过心魔劫的。', 67, 10)
ON CONFLICT DO NOTHING;
