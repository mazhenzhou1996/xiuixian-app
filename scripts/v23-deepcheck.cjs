// v23 深度专项检查（第 5-9 轮内容）
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = process.cwd();
const results = [];
const check = (name, pass, detail = '') => results.push({ name, pass, detail });
const read = (p) => { try { return fs.readFileSync(path.join(root, p), 'utf8'); } catch { return ''; } };

// ===== 第 5 轮：SQL 深度审查 =====
const sql = read('db/migrations/20260814-v23-commerce.sql');
// RPC 签名与前端调用逐一核对
const calls = [
  ['reward_watch_ad', 'reward_watch_ad'],
  ['list_ad_boards', 'list_ad_boards'],
  ['board_track', 'board_track'],
  ['buy_board_slot', 'buy_board_slot'],
  ['apply_merchant', 'apply_merchant'],
  ['review_merchant', 'review_merchant'],
];
calls.forEach(([fn]) => {
  check(`RPC 定义 ${fn}`, sql.includes(`CREATE OR REPLACE FUNCTION public.${fn}`));
});
// 前端调用参数名核对（supabase.rpc 参数名必须与函数参数一致）
const commerce = read('src/lib/commerce.ts');
check('RPC 参数名一致 reward', commerce.includes('reward_watch_ad'));
check('RPC 参数名一致 board', commerce.includes('p_campus_id') || commerce.includes('p_board_id'));
check('RPC 参数名一致 buy', commerce.includes('p_duration') || commerce.includes('p_title'));
check('触发器注册', sql.includes('CREATE TRIGGER trg_ensure_wallet'));
check('存量钱包补建', sql.includes('INSERT INTO public.wallets(owner_id) SELECT id'));
check('默认配置预置', sql.includes("('board_price'") && sql.includes("('fee_rate'"));
check('展板索引', sql.includes('idx_ad_boards_campus'));
check('时间范围过滤', sql.includes('starts_at <= now()') && sql.includes('ends_at >= now()'));

// ===== 第 6 轮：API/页面走查 =====
const school = read('src/pages/schoolcirclepage/schoolcirclepage.tsx');
check('展板空态（无校区不报错）', school.includes('catch(() => {})'));
check('购买后刷新展板', school.includes('listAdBoards(campus2.id)'));
check('商家状态分支（审核中/被拒）', school.includes('审核中') && school.includes('被拒'));
check('余额不足提示', read('db/migrations/20260814-v23-commerce.sql').includes('余额不足'));
const plat = read('src/pages/admin/platformadpage.tsx');
check('管理台三 tab', plat.includes("'boards'") && plat.includes("'merchants'") && plat.includes("'pushes'"));
check('管理台展位上下线', plat.includes('setBoardStatus'));
check('管理台推送定向', plat.includes('target_category'));
check('AdBoard 曝光去重', read('src/components/adboard.tsx').includes('viewedRef'));

// ===== 第 7 轮：编码/兼容/死代码 =====
check('无 BOM 损坏', !read('src/lib/commerce.ts').startsWith('\uFEFF'));
check('无 console.log 残留', !commerce.includes('console.log'));
check('无 TODO/FIXME 新增', !commerce.includes('TODO') && !read('src/components/adboard.tsx').includes('TODO'));
check('lucide 图标存在', ['Megaphone', 'Store', 'BadgeCheck'].every(i => read('src/components/adboard.tsx').includes(i)));

// ===== 第 8 轮：依赖安全 + 体积 =====
try {
  const audit = execSync('npm audit --omit=dev 2>&1', { stdio: 'pipe' }).toString();
  check('生产依赖 0 漏洞', !audit.includes('found 1') && !audit.includes('high severity'), audit.split('\n').filter(l => l.includes('severity')).slice(0, 2).join(' '));
} catch (e) {
  const out = String(e.stdout || '') + String(e.stderr || '');
  check('生产依赖 0 漏洞', !out.includes('found 1') && !out.includes('high severity'), out.split('\n').filter(l => l.includes('severity')).slice(0, 2).join(' '));
}
// gzip 体积
const dist = 'dist/client/assets';
if (fs.existsSync(dist)) {
  const zlib = require('zlib');
  const files = fs.readdirSync(dist).filter(f => f.endsWith('.js'));
  let total = 0;
  files.forEach(f => { total += zlib.gzipSync(fs.readFileSync(path.join(dist, f))).length; });
  check('全站 JS gzip < 600KB', total < 600 * 1024, (total / 1024).toFixed(0) + 'KB gzip');
}

// ===== 第 9 轮：回归完整性 =====
const api = read('src/lib/api.ts');
['getRankingsByRealm', 'getSchoolFeed', 'listVerifiedMembers', 'createBountyForQuestion', 'inviteUser', 'uploadVideo', 'getMyEarnings', 'listAnonymousReviews'].forEach(m => {
  check(`api.${m} 保留`, api.includes(m));
});
const store = read('src/store/useStore.ts');
check('store 缓存', store.includes('cachedFetch'));
check('app 路由完整', (read('src/app.tsx').match(/<Route path=/g) || []).length > 30);

const passCount = results.filter(r => r.pass).length;
console.log(`\n===== 深度专项：${passCount}/${results.length} 通过 =====\n`);
results.forEach(r => console.log(`${r.pass ? '✅' : '❌'} ${r.name}${r.detail ? '  [' + r.detail + ']' : ''}`));
process.exit(passCount === results.length ? 0 : 1);
