const { Client } = require('pg');
const HOST = process.env.DB_HOST || 'aws-0-ap-northeast-1.pooler.supabase.com';
const PORT = +(process.env.DB_PORT || 5432);
const DB = process.env.DB_NAME || 'postgres';
const USER = process.env.DB_USER || 'postgres.nwxtyxjborhrbesssopg';
const PASS = process.env.DB_PASS || 'qpalWOSK159';

(async () => {
  const client = new Client({ host: HOST, port: PORT, database: DB, user: USER, password: PASS, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await client.connect();
  const mode = process.argv[2] || 'tables';
  if (mode === 'tables') {
    const t = await client.query("select tablename from pg_tables where schemaname='public' order by tablename");
    console.log('TABLES (' + t.rows.length + '):');
    console.log(t.rows.map(r => r.tablename).join(', '));
    const v = await client.query("select viewname from pg_views where schemaname='public'");
    console.log('\nVIEWS (' + v.rows.length + '):');
    console.log(v.rows.map(r => r.viewname).join(', '));
    const f = await client.query("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by p.proname");
    console.log('\nFUNCTIONS (' + f.rows.length + '):');
    console.log(f.rows.map(r => r.proname).join(', '));
  } else if (mode === 'users') {
    const u = await client.query(`select id, email, phone, created_at, last_sign_in_at, raw_user_meta_data from auth.users order by created_at`);
    console.log('AUTH USERS (' + u.rows.length + '):');
    for (const r of u.rows) {
      console.log(JSON.stringify({ id: r.id, email: r.email, phone: r.phone, created: r.created_at, meta: r.raw_user_meta_data }));
    }
    const p = await client.query(`select id, nickname, phone, is_admin, realm, school, status, created_at from profiles order by created_at`);
    console.log('\nPROFILES (' + p.rows.length + '):');
    for (const r of p.rows) {
      console.log(JSON.stringify({ id: r.id, nickname: r.nickname, phone: r.phone, is_admin: r.is_admin, realm: r.realm, school: r.school, status: r.status, created: r.created_at }));
    }
  } else if (mode === 'schema-profiles') {
    const c = await client.query(`select column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema='public' and table_name='profiles' order by ordinal_position`);
    for (const r of c.rows) console.log(JSON.stringify(r));
  } else if (mode === 'sql') {
    const sql = process.argv[3];
    const r = await client.query(sql);
    console.log('rows:', r.rowCount);
    console.log(JSON.stringify(r.rows, null, 1).slice(0, 4000));
  }
  await client.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
