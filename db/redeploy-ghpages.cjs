// 仅推送 gh-pages 分支（构建产物）
const fs = require('fs');
const path = require('path');
const TOKEN = fs.readFileSync(path.join(__dirname, '.gh-pat.txt'), 'utf-8').trim();
const OWNER = 'mazhenzhou1996';
const REPO = 'xiuixian-app';
const API = 'https://api.github.com';
const HEADERS = { 'User-Agent': 'autoclaw-deploy', 'Authorization': `Bearer ${TOKEN}`, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' };
const ROOT = path.resolve(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(method, url, body) {
  const res = await fetch(API + url, { method, headers: HEADERS, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let j = null;
  try { j = text ? JSON.parse(text) : null; } catch { j = { raw: text.slice(0, 200) }; }
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return j;
}

function collectFiles(dir, prefix) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...collectFiles(path.join(dir, entry.name), rel));
    } else {
      out.push({ path: rel.replace(/\\/g, '/'), abs: path.join(dir, entry.name) });
    }
  }
  return out;
}

async function main() {
  const distDir = path.join(ROOT, 'dist', 'client');
  const files = collectFiles(distDir, '');
  console.log('dist files:', files.length);

  // blobs
  const entries = [];
  let i = 0;
  for (const f of files) {
    const b64 = fs.readFileSync(f.abs).toString('base64');
    const b = await api('POST', `/repos/${OWNER}/${REPO}/git/blobs`, { content: b64, encoding: 'base64' });
    entries.push({ path: f.path, mode: '100644', type: 'blob', sha: b.sha });
    i++;
    if (i % 50 === 0) console.log(`  blobs ${i}/${files.length}`);
    if (i % 20 === 0) await sleep(250);
  }
  console.log('  blobs done');
  // tree
  const tree = await api('POST', `/repos/${OWNER}/${REPO}/git/trees`, { tree: entries });
  console.log('  tree:', tree.sha.slice(0, 8));
  // commit
  const commit = await api('POST', `/repos/${OWNER}/${REPO}/git/commits`, {
    message: `deploy: production build ${new Date().toISOString().slice(0, 19)}Z`,
    tree: tree.sha,
  });
  console.log('  commit:', commit.sha.slice(0, 8));
  // ref (force update)
  await api('PATCH', `/repos/${OWNER}/${REPO}/git/refs/heads/gh-pages`, { sha: commit.sha, force: true });
  console.log('  gh-pages updated');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
