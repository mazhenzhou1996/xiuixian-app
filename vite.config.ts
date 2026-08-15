import path from 'path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    // Tailwind v4 必须通过此插件激活工具类扫描（缺失会导致构建产物无 utilities、页面无样式）
    tailwindcss(),
    {
      // EdgeOne Pages 静态资源不返回 Access-Control-Allow-Origin 头，
      // 带 crossorigin 的 <link rel="stylesheet"> 会被 Chromium 以 CORS 模式拒绝加载（样式丢失）
      name: 'strip-css-crossorigin',
      transformIndexHtml(html) {
        return html.replace(/<link rel="stylesheet" crossorigin/g, '<link rel="stylesheet"');
      },
    },
    {
      // SPA fallback：把 index.html 复制为 404.html，
      // 静态托管（GitHub Pages / EdgeOne / 任意 CDN）未命中文件时回退到 SPA 入口，
      // 配合 BrowserRouter 实现干净 URL + SEO 收录。
      name: 'spa-fallback-404',
      apply: 'build',
      closeBundle() {
        const out = path.resolve(__dirname, 'dist/client')
        const idx = path.join(out, 'index.html')
        const f404 = path.join(out, '404.html')
        if (!fs.existsSync(idx)) return
        // Windows 上 copyFileSync 偶发 EPERM（文件被安全软件/索引锁住）。
        // 用「读内容 → 写临时文件 → rename 覆盖」兜底，rename 是同一目录内的原子操作，
        // 不受 copyFile 的锁语义影响，且对目标已有 404.html 也能覆盖。
        try {
          fs.copyFileSync(idx, f404)
        } catch (err) {
          try {
            const html = fs.readFileSync(idx, 'utf8')
            const tmp = path.join(out, `404.${process.pid}.tmp`)
            fs.writeFileSync(tmp, html)
            fs.renameSync(tmp, f404)
          } catch (err2) {
            // 无论哪种方式失败都不阻断构建：SPA fallback 仅是部署增强，
            // 真机部署时再用脚本/托管规则补齐 404.html 即可。
            this.warn?.(`[spa-fallback-404] 生成 404.html 失败（不影响主构建）：${(err2 as Error)?.message ?? err2}`)
          }
        }
      },
    },
  ],
  // SEO 优化：使用绝对路径 base，配合 BrowserRouter 产出干净 URL（/question/123）
  // 部署需开启 SPA fallback（所有未命中静态文件回退到 index.html）
  // v39：绝对路径 base（深链接刷新必备——相对路径会让 /question/21 的资源解析到 /question/assets 下 404）。
  // 生产构建由 CI 注入 VITE_BASE（GitHub Pages 为 /xiuixian-app/）；本地构建默认 / 。
  base: process.env.VITE_BASE || '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist/client',
    // 生产构建不输出 sourcemap（旧构建曾把 3.3MB 的 .js.map 一起部署上线）
    sourcemap: false,
    target: 'es2020',
    // Windows 上 safe-delete 有兼容问题，关闭自动清空
    // 改用手动删除或用新目录名构建
    emptyOutDir: false,
    rollupOptions: {
      output: {
        // 资源最小化分包策略（省钱核心）：
        //  - vendor 基础库（react/router）所有页面共用，单块稳定缓存；
        //  - vendor-charts 仅后台管理仪表盘用到（recharts/d3），普通访客首屏不下载；
        //  - 其余第三方合并为 vendor-misc，避免零散小包。
        // 分层（react ← ui/charts ← app）无循环依赖，不会触发 TDZ 白屏。
        manualChunks(id) {
          // v23 遵循规格铁律：vendor 单包（多分包曾触发 chunk 循环依赖，白屏风险）
          if (!id.includes('node_modules')) return undefined;
          // v36：lucide-react 为纯图标库（零依赖），独立分包安全且首屏可并行下载
          if (id.includes('node_modules/lucide-react')) return 'icons';
          return 'vendor';
        },
      },
    },
  },
})
