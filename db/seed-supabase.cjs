// Supabase 种子数据脚本
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://nwxtyxjborhrbesssopg.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) { console.error('[seed] Please set SUPABASE_SERVICE_KEY env var (service_role key from Supabase dashboard).'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SEED_USERS = [
  { phone: '13800138001', nickname: '道友甲', realm: 'huashen', points: 50, bio: '修仙问道，不忘初心' },
  { phone: '13800138002', nickname: '文史爱好者', realm: 'yuanying', points: 30, bio: '热爱分享，交流学习' },
  { phone: '13800138003', nickname: '升学规划君', realm: 'jiedan', points: 80, bio: '专注升学规划与职业发展' },
  { phone: '13800138004', nickname: '我爱巧克力', realm: 'zhuji', points: 120, bio: '航海家，禾果妈妈暖心说' },
  { phone: '13800138005', nickname: '新道友', realm: 'lianqi', points: 0, bio: '初入修仙，请多指教' },
];

const SEED_QUESTIONS = [
  { uidIdx: 0, title: '筑基期应该如何选择功法？', content: '刚突破练气期进入筑基，面对众多功法不知如何选择。是优先考虑攻击型还是防御型？有没有道友分享一下经验？', type: 'normal', views: 1520, hot: 8500 },
  { uidIdx: 1, title: '修仙世界里，散修和有宗门的修士差距到底有多大？', content: '最近在研究修仙世界观，发现散修和有宗门的修士之间似乎存在着巨大的鸿沟。散修没有资源、没有功法，甚至连修炼的地方都很难找到……', type: 'normal', views: 2300, hot: 12000 },
  { uidIdx: 2, title: '元婴期突破化神需要做什么准备？', content: '卡在元婴圆满已经三年了，每次冲击化神都差一口气。求各位前辈指点，突破化神的心得体会。', type: 'paid', views: 980, hot: 4500 },
  { uidIdx: 3, title: '心魔劫到底怎么过？', content: '第三次渡心魔劫又失败了，每次都在最后关头功亏一篑。有没有渡过心魔劫的道友分享一下心得？', type: 'normal', views: 3100, hot: 15800 },
  { uidIdx: 0, title: '灵根资质对修炼速度影响有多大？', content: '五行灵根、异灵根、天灵根之间差异到底有多大？劣灵根真的没有逆袭的可能吗？', type: 'normal', views: 890, hot: 3200 },
];

const SEED_ANSWERS = [
  { qIdx: 0, uidIdx: 1, content: '建议筑基期先修炼通用功法打好基础，等到了金丹期再根据自身灵根属性选择专精方向。攻击和防御都很重要，但初期建议偏向防御保命为主。', likes: 42, comments: 8 },
  { qIdx: 0, uidIdx: 2, content: '我当年筑基时选了《太上感应篇》，虽然攻击力不强但根基扎实。后来顺利突破金丹和元婴，深感基础的重要性。推荐道友也走稳扎稳打的路线。', likes: 28, comments: 5 },
  { qIdx: 1, uidIdx: 0, content: '差距确实很大。有宗门的修士每年有固定的灵石月俸、丹药配给，还有长老指点。散修全靠自己，但散修也有优势——自由，不受宗门规矩束缚。', likes: 56, comments: 12 },
  { qIdx: 3, uidIdx: 1, content: '心魔劫主要考验的是心性。我的经验是：第一，平时多修身养性，少造杀孽；第二，渡劫前找一处灵气充沛的清静之地；第三，准备好清心丹和定神香。最重要的是放下执念。', likes: 89, comments: 15 },
  { qIdx: 3, uidIdx: 2, content: '三次失败说明你的心性还有不足。建议暂时放下突破的执念，云游四方体悟人生。我当年也是在凡间游历三年后才成功渡过心魔劫的。', likes: 67, comments: 10 },
];

async function seed() {
  console.log('开始种子数据导入...');
  const userIds = [];

  // 1. 创建 auth 用户
  for (const u of SEED_USERS) {
    const email = `${u.phone}@xiuixian.app`;
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: '123456',
      email_confirm: true,
      user_metadata: { phone: u.phone, nickname: u.nickname, realm: u.realm },
    });
    if (error) {
      // 用户可能已存在
      console.log(`  用户 ${u.nickname} 可能已存在，尝试查找...`);
      const { data: existing } = await supabase.auth.admin.listUsers();
      const user = existing?.users?.find(x => x.email === email);
      if (user) {
        userIds.push(user.id);
        await supabase.from('profiles').update({
          nickname: u.nickname, realm: u.realm, points: u.points, bio: u.bio, phone: u.phone,
        }).eq('id', user.id);
        console.log(`  用户 ${u.nickname} 已存在，已更新 (ID: ${user.id})`);
        continue;
      }
      console.error('创建用户失败:', u.phone, error.message);
      continue;
    }
    userIds.push(data.user.id);
    await supabase.from('profiles').update({
      nickname: u.nickname, realm: u.realm, points: u.points, bio: u.bio, phone: u.phone,
    }).eq('id', data.user.id);
    console.log(`  用户 ${u.nickname} 创建成功 (ID: ${data.user.id})`);
  }

  if (userIds.length === 0) {
    console.error('没有创建任何用户，终止');
    return;
  }

  // 2. 插入问题
  const questionIds = [];
  for (const q of SEED_QUESTIONS) {
    const uid = userIds[q.uidIdx];
    const { data, error } = await supabase.from('questions').insert({
      user_id: uid,
      title: q.title,
      content: q.content,
      type: q.type,
      view_count: q.views,
      hot_score: q.hot,
    }).select().single();
    if (error) { console.error('问题插入失败:', q.title, error.message); continue; }
    questionIds.push(data.id);
    console.log(`  问题 "${q.title}" 创建成功 (ID: ${data.id})`);
  }

  // 3. 插入回答
  for (const a of SEED_ANSWERS) {
    const qid = questionIds[a.qIdx];
    const uid = userIds[a.uidIdx];
    if (!qid) continue;
    const { data, error } = await supabase.from('answers').insert({
      question_id: qid,
      user_id: uid,
      content: a.content,
      like_count: a.likes,
      comment_count: a.comments,
    }).select().single();
    if (error) { console.error('回答插入失败:', error.message); continue; }
    console.log(`  回答创建成功 (ID: ${data.id})`);
  }

  console.log('\n种子数据导入完成!');
  console.log('测试账号（密码统一 123456）:');
  SEED_USERS.forEach(u => console.log(`  ${u.phone} / ${u.nickname}`));
}

seed().catch(err => {
  console.error('种子数据导入失败:', err);
  process.exit(1);
});
