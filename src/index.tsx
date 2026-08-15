import { App as CapacitorApp } from '@capacitor/app';
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

// 部署子路径支持：GitHub Pages 等子路径托管（如 /xiuixian-app/）需要 basename。
// v36：自动推导部署根——取 pathname 第一段作为 basename（/xiuixian-app/ → /xiuixian-app/，根域名 → /），
// 换域名/换托管零配置；也可用 .env 的 VITE_BASENAME 覆盖。
function deriveBasename(): string {
  try {
    const p = window.location.pathname;
    if (!p || p === '/') return '/';
    const first = p.split('/')[1];
    if (!first) return '/';
    return '/' + first + '/';
  } catch {
    return '/';
  }
}
const BASENAME: string = (import.meta.env.VITE_BASENAME as string | undefined) || deriveBasename();
import { ErrorBoundary } from "react-error-boundary";
import App from "./app";
import { SeoProvider } from "./components/Seo";
import "./index.css";

// ===== 白屏防护（v25）：全局错误捕获 + 自动恢复 =====
// 1) 捕获未处理 JS 错误（渲染崩溃前的最后防线）
window.addEventListener("error", (e) => {
  // 忽略资源加载错误（404 资源由构建 hash 保证，不影响主流程）
  if (e.target && (e.target as HTMLElement).tagName) return;
  console.error("[global-error]", e.message);
  sessionStorage.setItem("xiuixian-crash", String(Date.now()));
});

window.addEventListener("unhandledrejection", (e) => {
  console.error("[unhandled-rejection]", e.reason);
});

// 2) 白屏检测：页面加载 5 秒后 #root 仍为空 → 清缓存自动刷新（仅一次）
if (typeof window !== "undefined") {
  setTimeout(() => {
    const root = document.getElementById("root");
    if (root && root.children.length === 0) {
      const lastReload = Number(sessionStorage.getItem("xiuixian-reloaded") || 0);
      // 若 30 秒内已自动恢复过一次则不再循环刷新（避免死循环）
      if (Date.now() - lastReload > 30_000) {
        console.warn("[白屏检测] root 为空，清缓存并自动刷新");
        sessionStorage.setItem("xiuixian-reloaded", String(Date.now()));
        if ("serviceWorker" in navigator) {
          navigator.serviceWorker.getRegistrations().then((regs) => {
            regs.forEach((r) => r.unregister());
            caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
            window.location.reload();
          }).catch(() => window.location.reload());
        } else {
          window.location.reload();
        }
      }
    }
  }, 5000);
}

// 注册 Service Worker：缓存静态资源（JS/CSS/图片），
// 二次访问≈0 网络请求，显著降低 Edge/CDN 与 Supabase 的负担，提升 SEO 爬虫抓取速度。
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${BASENAME === "/" ? "" : BASENAME}/sw.js`).then((reg) => {
      // v37：新版本就绪提示（SW 更新）
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent('xiuixian-sw-update'));
          }
        });
      });
    }).catch(() => {});
  });
}

// 3) 错误边界：渲染崩溃时显示恢复页（一键清缓存重载）
function CrashFallback({ error }: { error: Error }) {
  const recover = () => {
    sessionStorage.setItem("xiuixian-crash", String(Date.now()));
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
        caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
      });
    }
    window.location.reload();
  };
  return (
    <div style={{ padding: 40, textAlign: "center", color: "#666", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>😵</div>
      <h2 style={{ fontSize: 18, margin: "0 0 8px", color: "#333" }}>页面出了点问题</h2>
      <p style={{ fontSize: 13, color: "#999", margin: "0 0 16px" }}>{error?.message || "未知错误"}</p>
      <button
        onClick={recover}
        style={{
          padding: "10px 24px", borderRadius: 999, border: "none", background: "#2563eb",
          color: "#fff", fontSize: 14, cursor: "pointer",
        }}
      >
        一键恢复（清缓存刷新）
      </button>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={BASENAME}>
      <SeoProvider>
        <ErrorBoundary fallbackRender={({ error }) => <CrashFallback error={error as Error} />}>
          <App />
        </ErrorBoundary>
      </SeoProvider>
    </BrowserRouter>
  </StrictMode>,
);

// ===== Android 杩斿洖閿紙v34锛夛細鏈夊巻鍙插垯杩斿洖涓婁竴椤碉紝闈為椤靛洖棣栭〉锛岄椤甸€€鍑?=====
try {
  CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    const path = window.location.pathname;
    if (canGoBack && window.history.length > 1) {
      window.history.back();
    } else if (path !== '/') {
      window.location.href = '/';
    } else {
      CapacitorApp.exitApp();
    }
  });
} catch { /* 闈?Capacitor 鐜蹇界暐 */ }
