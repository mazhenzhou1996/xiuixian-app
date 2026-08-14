// GitHub 全自动部署：建仓 + 推源码(main) + 推构建产物(gh-pages) + 开启 Pages
const fs = require('fs');
const path = require('path');

const TOKEN = fs.readFileSync(path.join(__dirname, '.gh-pat.txt'), 'utf-8').trim();
const OWNER = 'mazhenzhou1996';
const REPO = 'xiuixian-app';
const API = 'https://api.github.com';
const HEADERS = {
  'User-Agent': 'autoclaw-deploy',
  'Authorization': `Bearer ${TOKEN}`,
  'Accept': 'application/vnd.github+json',
  'Content-Type': 'application/json',
};

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.qa', 'android', '.npm-cache', '.github']);
const SKIP_FILES = new Set([
  '.env', 'db/.gh-pat.txt', 'db/.gh-session-cookies.txt', 'db/.gh-token.txt',
  'db/_scan_pat.py', 'db/_test_signup.cjs', 'db/_test_sel.cjs', 'db/_test_row1.cjs',
  'db/_test_slice.cjs', 'db/_test_array.cjs', 'db/_test_seed_array.cjs', 'db/_test_seed_full.cjs',
  'db/_test_seed_rows.cjs', 'db/_diag.cjs', 'db/_cdp_check.cjs', 'db/_gh_auth.cjs',
  'db/_gh_token.cjs', 'db/_gh_token2.cjs', 'db/_gh_readpage.cjs', 'db/_gh_readtoken.cjs',
  'db/_gh_inspect.cjs', 'db/_patch_*.py', 'db/_scan_raise.py', 'db/_scan_pat.py',
]);

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(method, url, body) {
  const res = await fetch(API + url, {
    method, headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let j = null;
  try { j = text ? JSON.parse(text) : null; } catch { j = { raw: text.slice(0, 200) }; }
  if (!res.ok) {
    throw new Error(`${method} ${url} -> ${res.status}: ${JSON.stringify(j).slice(0, 200)}`);
  }
  return j;
}

function collectFiles(dir, prefix) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(...collectFiles(path.join(dir, entry.name), rel));
    } else {
      if (SKIP_FILES.has(rel)) continue;
      if (rel.startsWith('db/_')) continue; // 本地调试脚本不上传
      out.push({ path: rel, abs: path.join(dir, entry.name) });
    }
  }
  return out;
}

async function pushBranch(branch, files, message, parentSha) {
  // 1) blobs
  const blobs = [];
  let i = 0;
  for (const f of files) {
    const b64 = fs.readFileSync(f.abs).toString('base64');
    const b = await api('POST', `/repos/${OWNER}/${REPO}/git/blobs`, { content: b64, encoding: 'base64' });
    blobs.push({ path: f.path.replace(/\\/g, '/'), mode: '100644', type: 'blob', sha: b.sha });
    i++;
    if (i % 50 === 0) console.log(`  blobs ${i}/${files.length}`);
    if (i % 20 === 0) await sleep(300);
  }
  console.log(`  blobs done: ${files.length}`);
  // 2) tree
  const tree = await api('POST', `/repos/${OWNER}/${REPO}/git/trees`, { tree: blobs });
  // 3) commit
  const commit = await api('POST', `/repos/${OWNER}/${REPO}/git/commits`, {
    message,
    tree: tree.sha,
    ...(parentSha ? { parents: [parentSha] } : {}),
  });
  // 4) ref
  try {
    await api('POST', `/repos/${OWNER}/${REPO}/git/refs`, { ref: `refs/heads/${branch}`, sha: commit.sha });
  } catch (e) {
    if (e.message.includes('422')) {
      await api('PATCH', `/repos/${OWNER}/${REPO}/git/refs/heads/${branch}`, { sha: commit.sha, force: true });
    } else throw e;
  }
  console.log(`  branch ${branch} -> ${commit.sha.slice(0, 8)}`);
  return commit.sha;
}

async function main() {
  console.log('== [1/4] 创建仓库 ==');
  let repo;
  try {
    repo = await api('POST', '/user/repos', {
      name: REPO, description: '修仙问答 - 大学生问答社区（React 19 + Supabase）', private: false, has_issues: true, has_wiki: false,
    });
    console.log('  created:', repo.full_name);
  } catch (e) {
    if (e.message.includes('422') && e.message.includes('name already exists')) {
      console.log('  已存在，复用');
      repo = await api('GET', `/repos/${OWNER}/${REPO}`);
    } else throw e;
  }

  // 空仓库初始化：GitHub 要求先有初始提交才能用 git data API
  const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
  const initCommit = await api('POST', `/repos/${OWNER}/${REPO}/git/commits`, {
    message: 'init', tree: EMPTY_TREE,
  });
  try {
    await api('POST', `/repos/${OWNER}/${REPO}/git/refs`, { ref: 'refs/heads/main', sha: initCommit.sha });
    console.log('  init commit ->', initCommit.sha.slice(0, 8));
  } catch (e) {
    console.log('  init ref 可能已存在:', e.message.slice(0, 80));
  }

  console.log('== [2/4] 推送源码到 main ==');
  const srcFiles = collectFiles(ROOT, '');
  console.log(`  source files: ${srcFiles.length}`);
  // 检查有没有误收敏感文件
  const sensitive = srcFiles.filter(f => /gh-pat|gh-session|\.env$|\.gh-/.test(f.path));
  if (sensitive.length) { console.log('  !! 敏感文件被收集:', sensitive.map(s => s.path)); process.exit(1); }
  const mainSha = await pushBranch('main', srcFiles, 'xiuixian v29: 全量上线（公开注册 + 管理后台）', null);

  console.log('== [3/4] 推送构建产物到 gh-pages ==');
  const distDir = path.join(ROOT, 'dist', 'client');
  const distFiles = collectFiles(distDir, '');
  console.log(`  dist files: ${distFiles.length}`);
  await pushBranch('gh-pages', distFiles, 'deploy: production build', null);

  console.log('== [4/4] 开启 GitHub Pages ==');
  try {
    const p = await api('POST', `/repos/${OWNER}/${REPO}/pages`, { source: { branch: 'gh-pages', path: '/' } });
    console.log('  pages enabled:', p.html_url || 'ok');
  } catch (e) {
    console.log('  pages enable err:', e.message.slice(0, 150));
    try {
      const p2 = await api('PUT', `/repos/${OWNER}/${REPO}/pages`, { source: { branch: 'gh-pages', path: '/' } });
      console.log('  pages (PUT) ok');
    } catch (e2) { console.log('  pages PUT err:', e2.message.slice(0, 150)); }
  }
  console.log('DONE');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
