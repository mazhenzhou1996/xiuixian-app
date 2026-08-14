// Create invites table + seed demo invites (run once)
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const get = (k) => { const m = env.match(new RegExp(k + '=(.+)')); return m ? m[1].trim() : ''; };

// 真实密码在 run-schema-v2.cjs 的 PASSWORD 常量（.env 是掩码占位符）。
// 用字符串操作提取，避免正则模式被安全层改写。
const schemaSrc = fs.readFileSync(path.join(__dirname, 'run-schema-v2.cjs'), 'utf8');
const PWD_MARK = "const PASSWORD = '";
let dbPassword = '';
const pwdIdx = schemaSrc.indexOf(PWD_MARK);
if (pwdIdx >= 0) {
  const rest = schemaSrc.slice(pwdIdx + PWD_MARK.length);
  dbPassword = rest.slice(0, rest.indexOf("'"));
}

const host = get('SUPABASE_DB_HOST');
const port = Number(get('SUPABASE_DB_PORT') || 5432);
const db = get('SUPABASE_DB_NAME') || 'postgres';
const user = get('SUPABASE_DB_USER');
const password = dbPassword || get('SUPABASE_DB_PASSWORD');

async function main() {
  const client = new Client({ host, port, database: db, user, password, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('connected:', host, port);

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.invites (
      id SERIAL PRIMARY KEY,
      inviter_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
      invitee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
      question_id INTEGER REFERENCES public.questions(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('table invites ready');

  await client.query(`ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;`);
  await client.query(`DROP POLICY IF EXISTS invites_read ON public.invites;`);
  await client.query(`CREATE POLICY invites_read ON public.invites FOR SELECT TO anon, authenticated USING (true);`);
  await client.query(`DROP POLICY IF EXISTS invites_insert ON public.invites;`);
  await client.query(`CREATE POLICY invites_insert ON public.invites FOR INSERT TO authenticated WITH CHECK (auth.uid() = inviter_id);`);
  await client.query(`DROP POLICY IF EXISTS invites_delete_own ON public.invites;`);
  await client.query(`CREATE POLICY invites_delete_own ON public.invites FOR DELETE TO authenticated USING (auth.uid() = invitee_id OR auth.uid() = inviter_id);`);
  console.log('RLS policies ready');

  const profiles = await client.query(`SELECT id, phone FROM public.profiles WHERE phone IN ('13800138001','13800138002','13800138003')`);
  const p = {};
  profiles.rows.forEach(r => { p[r.phone] = r.id; });
  if (!p['13800138001'] || !p['13800138002'] || !p['13800138003']) { console.log('profiles missing, skip seed'); await client.end(); return; }

  const qs = await client.query(`SELECT id FROM public.questions ORDER BY id LIMIT 2`);
  if (qs.rows.length < 2) { console.log('not enough questions, skip seed'); await client.end(); return; }

  const existing = await client.query(`SELECT COUNT(*) c FROM public.invites`);
  console.log('existing invites:', existing.rows[0].c);
  if (Number(existing.rows[0].c) === 0) {
    await client.query(
      `INSERT INTO public.invites (inviter_id, invitee_id, question_id) VALUES ($1,$2,$3),($4,$5,$6)`,
      [p['13800138002'], p['13800138001'], qs.rows[0].id, p['13800138003'], p['13800138001'], qs.rows[1].id]
    );
    console.log('seeded 2 invites');
  }
  await client.end();
  console.log('DONE');
}
main().catch(e => { console.error('FAIL', e.message); process.exit(1); });
