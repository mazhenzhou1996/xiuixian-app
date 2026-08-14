const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const HOST = process.env.DB_HOST || 'aws-0-ap-northeast-1.pooler.supabase.com';
const PORT = +(process.env.DB_PORT || 5432);
const DB = process.env.DB_NAME || 'postgres';
const USER = process.env.DB_USER || 'postgres.nwxtyxjborhrbesssopg';
const PASS = process.env.DB_PASS || 'qpalWOSK159';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const ORDER = [
  '20260813-p0-fixes.sql',
  '20260813-admin-v2.sql',
  '20260813-admin-v3.sql',
  '20260813-admin-v4.sql',
  '20260813-realm-v5.sql',
  '20260813-credit-v6.sql',
  '20260813-content-v7.sql',
  '20260813-consult-v8.sql',
  '20260814-wallet-v10.sql',
  '20260814-bounty-v9.sql',
  '20260814-fix-wallet-ambiguity.sql',
  '20260814-fix-reports-constraint.sql',
  '20260814-fix-admin-users.sql',
  '20260814-v11-community.sql',
  '20260814-v12-launch-gap.sql',
  '20260814-v13-notifications.sql',
  '20260814-v14-dashboard.sql',
  '20260814-v16-launch.sql',
  '20260814-v18-school-verify.sql',
  '20260814-v19-invite-bounty.sql',
  '20260814-v20-pm-media.sql',
  '20260814-v23-commerce.sql',
  '20260814-v25-features.sql',
  '20260814-v26-confession.sql',
  '20260814-v27-admin.sql',
  '20260814-v28-review-hot.sql',
  '20260814-v29-todo-reward.sql',
];

(async () => {
  const client = new Client({ host: HOST, port: PORT, database: DB, user: USER, password: PASS, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 20000 });
  await client.connect();
  const results = [];
  // 预清理：历史版本残留对象
  try {
    const pre = fs.readFileSync(path.join(__dirname, 'pre-fix.sql'), 'utf-8');
    await client.query('BEGIN');
    await client.query(pre);
    await client.query('COMMIT');
    console.log('[OK]  pre-fix.sql');
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.log('[FAIL] pre-fix.sql :: ' + e.message);
  }
  for (const f of ORDER) {
    const file = path.join(MIGRATIONS_DIR, f);
    if (!fs.existsSync(file)) { results.push({ file: f, status: 'SKIP (missing)' }); continue; }
    const sql = fs.readFileSync(file, 'utf-8');
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      results.push({ file: f, status: 'OK' });
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      results.push({ file: f, status: 'FAIL', error: e.message });
    }
  }
  for (const r of results) {
    console.log((r.status === 'OK' ? '[OK]  ' : '[FAIL]') + ' ' + r.file + (r.error ? ' :: ' + r.error : ''));
  }
  await client.end();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
