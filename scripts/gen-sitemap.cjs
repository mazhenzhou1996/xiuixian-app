#!/usr/bin/env node
/**
 * 修仙问答 · sitemap.xml 生成脚本
 * 读取 Supabase 中已公开的问题，生成符合搜索引擎规范的 sitemap.xml。
 *
 * 用法（构建后执行）：
 *   VITE_SUPABASE_URL=xxx VITE_SUPABASE_ANON_KEY=yyy node scripts/gen-sitemap.cjs
 * 或把这两个变量写进 .env（Vite 约定 VITE_ 前缀），脚本会自动读取 process.env。
 *
 * 输出的 sitemap.xml 放在 public/ 下，随构建产物一起部署到站点根目录。
 * 然后在百度站长平台 / Google Search Console / Bing Webmaster 提交该文件。
 */
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const SITE_URL = (process.env.VITE_SITE_URL || 'https://xiuixian.app').replace(/\/$/, '');

async function main() {
  if (!SUPABASE_URL || !ANON_KEY) {
    console.warn('[sitemap] 未检测到 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY，生成仅含静态页的 sitemap。');
    writeSitemap(buildStaticOnly());
    return;
  }

  // 优先用 Supabase REST（无额外依赖）
  const headers = {
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
    'Content-Type': 'application/json',
  };

  let urls = [];
  try {
    // 分页拉取已公开问题（status 公开、未删除）。一次最多 1000，循环翻页。
    let offset = 0;
    const LIMIT = 1000;
    while (true) {
      const q = `${SUPABASE_URL}/rest/v1/questions?select=id,created_at&order=created_at.desc&limit=${LIMIT}&offset=${offset}`;
      const res = await fetch(q, { headers });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const rows = await res.json();
      if (!rows.length) break;
      urls.push(...rows);
      if (rows.length < LIMIT) break;
      offset += LIMIT;
    }
  } catch (e) {
    console.warn('[sitemap] 拉取问题失败：', e.message, '——生成仅含静态页的 sitemap。');
    writeSitemap(buildStaticOnly());
    return;
  }

  const items = urls
    .map((q) => {
      const lastmod = (q.created_at || new Date().toISOString())
        .toString()
        .slice(0, 10);
      return {
        loc: `${SITE_URL}/question/${q.id}`,
        lastmod,
        changefreq: 'daily',
        priority: '0.8',
      };
    })
    .concat(buildStaticOnly());

  writeSitemap(items);
  console.log(`[sitemap] 已生成 ${items.length} 条 URL（含 ${urls.length} 个问题页）。`);
}

function buildStaticOnly() {
  const now = new Date().toISOString().slice(0, 10);
  return [
    { loc: `${SITE_URL}/`, lastmod: now, changefreq: 'always', priority: '1.0' },
    { loc: `${SITE_URL}/hot`, lastmod: now, changefreq: 'hourly', priority: '0.9' },
    { loc: `${SITE_URL}/rank`, lastmod: now, changefreq: 'daily', priority: '0.7' },
    { loc: `${SITE_URL}/topic/university`, lastmod: now, changefreq: 'weekly', priority: '0.6' },
    { loc: `${SITE_URL}/topic/graduate`, lastmod: now, changefreq: 'weekly', priority: '0.6' },
  ];
}

function writeSitemap(items) {
  const urlset = items
    .map(
      (it) =>
        `  <url>\n    <loc>${it.loc}</loc>\n    <lastmod>${it.lastmod}</lastmod>\n    <changefreq>${it.changefreq}</changefreq>\n    <priority>${it.priority}</priority>\n  </url>`
    )
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlset}\n</urlset>\n`;
  const out = path.resolve(__dirname, '..', 'public', 'sitemap.xml');
  fs.writeFileSync(out, xml, 'utf8');
  console.log('[sitemap] 写入', out);
}

main().catch((e) => {
  console.error('[sitemap] 失败：', e);
  process.exit(1);
});
