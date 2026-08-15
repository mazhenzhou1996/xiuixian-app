// Supabase 种子数据脚本
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://nwxtyxjborhrbesssopg.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) { console.error('[seed] Please set SUPABASE_SERVICE_KEY env var (service_role key from Supabase dashboard).'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// v32：仅保留本人账号，演示账号已全部移除
const SEED_USERS = [
  { email: 'mazhenzhou1996@163.com', nickname: 'mazhenzhou1996', realm: 'huashen', points: 100, bio: '修仙问答创始人' },
];

// v32：不再种演示内容
const SEED_QUESTIONS = [];

// v32：不再种演示内容
const SEED_ANSWERS = [];

async function seed() {
  console.log('开始种子数据导入...');
  const userIds = [];

  // 1. 创建 auth 用户
  for (const u of SEED_USERS) {
    const email = u.email;
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
          nickname: u.nickname, realm: u.realm, points: u.points, bio: u.bio, phone: u.email,
        }).eq('id', user.id);
        console.log(`  用户 ${u.nickname} 已存在，已更新 (ID: ${user.id})`);
        continue;
      }
      console.error('创建用户失败:', u.email, error.message);
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
  console.log('账号:');
  SEED_USERS.forEach(u => console.log(`  ${u.email} / ${u.nickname}`));
}

seed().catch(err => {
  console.error('种子数据导入失败:', err);
  process.exit(1);
});
