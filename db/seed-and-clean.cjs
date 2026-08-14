const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const HOST = process.env.DB_HOST || 'aws-0-ap-northeast-1.pooler.supabase.com';
const PASS = process.env.DB_PASS || 'qpalWOSK159';

(async () => {
  const client = new Client({ host: HOST, port: 5432, database: 'postgres', user: 'postgres.nwxtyxjborhrbesssopg', password: PASS, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 20000 });
  await client.connect();

  // 1) 清理注册测试产生的账号
  const del = await client.query(`DELETE FROM auth.users WHERE email LIKE 'test%' OR email LIKE '1991%' OR email LIKE '1990%'`);
  console.log('cleaned test users:', del.rowCount);

  // 2) 种子内容（GBK 编码文件 -> 转 UTF-8 执行）
  const seedPath = path.join(__dirname, 'seed-content-v15.sql');
  const raw = fs.readFileSync(seedPath);
  let sql;
  try { sql = raw.toString('utf8'); } catch { sql = null; }
  // 检测 GBK：用 TextDecoder gbk
  const { TextDecoder } = require('util');
  try {
    const td = new TextDecoder('gbk');
    const asUtf8 = td.decode(raw);
    // 若 utf8 解码出现 U+FFFD 则说明是 GBK
    if (sql && !sql.includes('\uFFFD')) {
      // utf8 正常
    } else {
      sql = asUtf8;
    }
  } catch {
    // TextDecoder gbk 不可用时保持原样
  }
  await client.query('BEGIN');
  await client.query(sql);
  await client.query('COMMIT');
  console.log('seed-content executed');

  const q = await client.query(`SELECT count(*) c FROM questions`);
  console.log('questions now:', q.rows[0].c);
  const a = await client.query(`SELECT count(*) c FROM answers`);
  console.log('answers now:', a.rows[0].c);
  const u = await client.query(`SELECT id, nickname, is_admin FROM profiles`);
  console.log('profiles:', JSON.stringify(u.rows));
  await client.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
