const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const HOST = process.env.DB_HOST || 'aws-0-ap-northeast-1.pooler.supabase.com';
const PORT = +(process.env.DB_PORT || 5432);
const DB = process.env.DB_NAME || 'postgres';
const USER = process.env.DB_USER || 'postgres.nwxtyxjborhrbesssopg';
const PASS = process.env.DB_PASS || 'qpalWOSK159';

(async () => {
  const file = process.argv[2];
  const sql = fs.readFileSync(path.join(__dirname, 'migrations', file), 'utf-8');
  const client = new Client({ host: HOST, port: PORT, database: DB, user: USER, password: PASS, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 20000 });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('OK');
  } catch (e) {
    console.log('ERR:', e.message);
    if (e.position) {
      const pos = +e.position;
      const lines = sql.slice(0, pos).split('\n');
      const lineNo = lines.length;
      const colNo = lines[lines.length - 1].length + 1;
      const start = Math.max(0, pos - 300);
      const end = Math.min(sql.length, pos + 300);
      console.log('POS:', pos, 'line:', lineNo, 'col:', colNo);
      console.log('--- context ---');
      console.log(sql.slice(start, end));
    }
    try { await client.query('ROLLBACK'); } catch (_) {}
  }
  await client.end();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
