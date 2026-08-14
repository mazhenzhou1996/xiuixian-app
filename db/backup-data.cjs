// 全量备份 Supabase 数据到 db/backup/
const fs = require('fs');
const path = require('path');
const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const getEnv = (k) => { const m = env.match(new RegExp(k + '=(.+)')); return m ? m[1].trim() : ''; };
const url = getEnv('SUPABASE_URL');
const key = getEnv('SUPABASE_SERVICE_KEY');
const h = { apikey: key, Authorization: '***' + key };
const TABLES = ['profiles', 'questions', 'answers', 'comments', 'likes', 'favorites', 'follows', 'read_messages', 'invites'];

(async () => {
  const out = {};
  for (const t of TABLES) {
    try {
      const r = await fetch(`${url}/rest/v1/${t}?select=*&limit=5000`, { headers: h });
      if (!r.ok) { out[t] = { error: 'HTTP ' + r.status }; continue; }
      out[t] = await r.json();
      console.log(t + ':', out[t].length, 'rows');
    } catch (e) {
      out[t] = { error: e.message };
      console.log(t + ': ERROR ' + e.message);
    }
  }
  const dir = path.join(__dirname, 'backup');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const file = path.join(dir, `supabase-backup-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log('BACKUP SAVED:', file);
})().catch(e => console.log('FATAL', e.message));
