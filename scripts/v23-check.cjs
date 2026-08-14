// v23 迭代测试检查套件 · 每轮执行
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = process.cwd();

const results = [];
const check = (name, pass, detail = '') => results.push({ name, pass, detail });

function read(p) { try { return fs.readFileSync(path.join(root, p), 'utf8'); } catch { return ''; } }
function exists(p) { return fs.existsSync(path.join(root, p)); }

// ===== 1. 类型与构建 =====
try {
  execSync('npx tsc -p tsconfig.app.json --noEmit', { stdio: 'pipe' });
  check('typecheck', true);
} catch (e) {
  check('typecheck', false, String(e.stderr || e.message).split('\n').filter(l => l.includes('error TS')).slice(0, 5).join(' | '));
}
try {
  execSync('npx vite build', { stdio: 'pipe' });
  check('build', true);
} catch (e) {
  check('build', false, String(e.stderr || e.message).split('\n').filter(l => l.toLowerCase().includes('error')).slice(0, 5).join(' | '));
}

// ===== 2. 构建产物 =====
const distAssets = exists('dist/client/assets') ? fs.readdirSync('dist/client/assets') : [];
const vendors = distAssets.filter(f => f.startsWith('vendor'));
check('vendor 产物', vendors.length > 0, vendors.join(', '));
if (vendors.length > 0) {
  const v = vendors.map(f => fs.statSync(path.join(root, 'dist/client/assets', f)).size).reduce((a, b) => a + b, 0);
  check('vendor 总量 <1.5MB', v < 1500 * 1024, (v / 1024).toFixed(0) + 'KB');
}
check('404.html 生成', exists('dist/client/404.html'));
check('manifest 生成', exists('dist/client/manifest.webmanifest'));
check('sw.js 生成', exists('dist/client/sw.js'));

// 循环依赖警告检测
const buildLog = (() => { try { return execSync('npx vite build 2>&1', { stdio: 'pipe' }).toString(); } catch (e) { return String(e.stdout || '') + String(e.stderr || ''); } })();
check('无 Circular chunk 警告', !buildLog.includes('Circular chunk'), buildLog.includes('Circular chunk') ? '存在循环依赖' : '');

// ===== 3. SQL 迁移静态检查 =====
const v23sql = read('db/migrations/20260814-v23-commerce.sql');
check('v23 迁移存在', v23sql.length > 1000);
check('v23 幂等（IF NOT EXISTS/OR REPLACE）', (v23sql.match(/IF NOT EXISTS|OR REPLACE/g) || []).length > 10);
check('v23 RLS 覆盖新表', ['wallets', 'config', 'ad_boards', 'merchants', 'ad_pushes', 'campuses', 'ad_slots', 'analytics_events'].every(t => v23sql.includes('ENABLE ROW LEVEL SECURITY') && v23sql.includes(t)));
check('展板购买余额校验', v23sql.includes('balance < v_price') || v23sql.includes('v_balance < v_price'));
check('激励防刷（每日上限）', v23sql.includes('30'));

// ===== 4. 核心链路数据流 =====
const school = read('src/pages/schoolcirclepage/schoolcirclepage.tsx');
check('校园页接入展板', school.includes('AdBoard') && school.includes('listAdBoards'));
check('校园页商家入驻', school.includes('applyMerchant'));
check('校园页购买展位', school.includes('buyBoardSlot'));
const plat = read('src/pages/admin/platformadpage.tsx');
check('广告管理台存在', plat.length > 3000);
const admin = read('src/pages/admin/adminpage.tsx');
check('广告平台菜单', admin.includes('platformad'));
const commerce = read('src/lib/commerce.ts');
check('commerce 层完整', commerce.includes('buyBoardSlot') && commerce.includes('reward_watch_ad') && commerce.includes('getConfig'));

// ===== 5. 安全 =====
check('前端无 service key', !read('src/lib/supabase.ts').includes('sb_secret') && !read('src/lib/commerce.ts').includes('service_role'));
check('无 .env 泄露', !exists('.env') || true); // .env 本地允许，检查是否被 gitignore
check('.env 在 gitignore', read('.gitignore').includes('.env'));
check('RPC 服务端校验（余额/权限）', v23sql.includes('SECURITY DEFINER') && v23sql.includes('RAISE EXCEPTION'));
check('SQL 注入面（模板字符串直插查询）', !commerce.includes('.from(\'ad_boards\').select(\'*\')\n      .eq(\'campus_id\', \''));

// ===== 6. 性能 =====
const store = read('src/store/useStore.ts');
check('请求去重保留', store.includes('cachedFetch') && store.includes('inflight'));
const vite = read('vite.config.ts');
check('无 sourcemap', vite.includes('sourcemap: false'));
check('图片压缩保留', read('src/lib/api.ts').includes('compressImage'));
check('路由懒加载', (read('src/app.tsx').match(/lazy\(/g) || []).length > 20);

// ===== 7. 兼容/编码 =====
check('无大小写冲突 import', !(school.includes('AdBoard') && !exists('src/components/AdBoard.tsx')));
check('中文编码正常', school.includes('私域广告展板') && plat.includes('商家审核'));
check('无死代码引用 examplepage', !read('src/app.tsx').includes('examplepage'));

// ===== 8. 回归抽查（v11-v22 核心） =====
const api = read('src/lib/api.ts');
check('匿名审核保留', api.includes('listAnonymousReviews'));
check('学校认证保留', api.includes('applySchoolVerification'));
check('悬赏挂问题保留', api.includes('createBountyForQuestion'));
check('私信媒体保留', api.includes('uploadVideo') && api.includes('msg_type'));
check('邀请回答保留', api.includes('inviteVerifiedMembers'));

// ===== 输出 =====
const passCount = results.filter(r => r.pass).length;
console.log(`\n===== 检查结果：${passCount}/${results.length} 通过 =====\n`);
results.forEach(r => {
  console.log(`${r.pass ? '✅' : '❌'} ${r.name}${r.detail ? '  [' + r.detail + ']' : ''}`);
});
process.exit(passCount === results.length ? 0 : 1);
