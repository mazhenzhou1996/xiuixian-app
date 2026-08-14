#!/usr/bin/env node
/**
 * 修仙问答 · 静态预渲染（SSG）脚本
 * ----------------------------------------------------------------
 * 为「百度基础爬虫（不执行 JS）」「头条基础抓取」等无法渲染 SPA 的引擎，
 * 在构建产物 dist/client 下生成真实静态 HTML：
 *     dist/client/question/<id>/index.html
 * 内含：完整标题/描述/meta/canonical + QAPage JSON-LD + 问题正文与答案摘要。
 *
 * 这样即使爬虫不跑 JS，也能抓到结构化内容 → 直接决定百度/头条收录与排名。
 *
 * 用法（在 vite build 之后执行）：
 *   node scripts/prerender.cjs
 * 需要 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY（.env 即可）。
 * 未配置或拉取失败时，脚本安全跳过（不影响部署）。
 */
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const SITE_URL = (process.env.VITE_SITE_URL || 'https://xiuixian.app').replace(/\/$/, '');
const OUT_DIR = path.resolve(__dirname, '..', 'dist', 'client');
const LIMIT = Number(process.env.PRERENDER_LIMIT || 200); // 预渲染前 N 个热门问题

const esc = (s) =>
  String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function qaJsonLd(q, answers) {
  return {
    '@context': 'https://schema.org',
    '@type': 'QAPage',
    mainEntity: {
      '@type': 'Question',
      name: q.title,
      text: q.content || q.title,
      answerCount: answers.length,
      acceptedAnswer: answers[0]
        ? { '@type': 'Answer', text: answers[0].content }
        : undefined,
    },
  };
}

function renderHtml(q, answers) {
  const desc = (q.content || q.title || '').slice(0, 160);
  const jsonLd = qaJsonLd(q, answers);
  const answerHtml = answers
    .slice(0, 5)
    .map(
      (a) =>
        `<div class="answer"><p>${esc((a.content || '').slice(0, 300))}</p></div>`
    )
    .join('\n');
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(q.title)} - 修仙问答</title>
<meta name="description" content="${esc(desc)}" />
<meta name="keywords" content="修仙问答,${esc(q.title)},功法,渡劫,灵根" />
<link rel="canonical" href="${SITE_URL}/question/${q.id}" />
<meta property="og:title" content="${esc(q.title)} - 修仙问答" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:type" content="article" />
<meta property="og:url" content="${SITE_URL}/question/${q.id}" />
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
<header><a href="/">修仙问答</a></header>
<main>
<h1>${esc(q.title)}</h1>
<article>${esc(q.content || '')}</article>
<h2>精选回答</h2>
${answerHtml}
</main>
<footer><a href="/">回到首页</a></footer>
</body>
</html>`;
}

async function fetchTopQuestions() {
  const headers = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` };
  const q = `${SUPABASE_URL}/rest/v1/questions?select=id,title,content,hot_score&order=hot_score.desc&limit=${LIMIT}`;
  const res = await fetch(q, { headers });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function fetchAnswers(qid) {
  const headers = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` };
  const q = `${SUPABASE_URL}/rest/v1/answers?select=content&question_id=eq.${qid}&order=like_count.desc&limit=5`;
  const res = await fetch(q, { headers });
  if (!res.ok) return [];
  return res.json();
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    console.warn('[prerender] 未找到 dist/client，请先执行 vite build。已跳过。');
    return;
  }
  if (!SUPABASE_URL || !ANON_KEY) {
    console.warn('[prerender] 缺少 Supabase 凭据，跳过静态预渲染（SPA 模式仍可被 JS 爬虫收录）。');
    return;
  }
  let questions;
  try {
    questions = await fetchTopQuestions();
  } catch (e) {
    console.warn('[prerender] 拉取问题失败：', e.message, '——跳过。');
    return;
  }
  let ok = 0;
  for (const q of questions) {
    try {
      const answers = await fetchAnswers(q.id);
      const html = renderHtml(q, answers);
      const dir = path.join(OUT_DIR, 'question', String(q.id));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
      ok++;
    } catch {
      /* 单条失败不影响其他 */
    }
  }
  console.log(`[prerender] 已静态预渲染 ${ok}/${questions.length} 个问题页 → dist/client/question/<id>/index.html`);
}

main().catch((e) => {
  console.error('[prerender] 失败：', e);
});
