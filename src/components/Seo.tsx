import { useEffect } from "react";
import { createContext, useContext } from "react";
import type { ReactNode } from "react";

// ── 零依赖 SEO 组件 ───────────────────────────────────────────────
// 作用：在客户端渲染时注入 <title>/<meta>/<link canonicl>/JSON-LD，
// 覆盖百度/豆包/头条(字节系 headless Chrome)/Google/Bing 等会执行 JS 的爬虫。
// 注：纯静态预渲染（给不执行 JS 的百度基础爬虫）由 scripts/prerender.cjs 在构建时生成。

const SITE_NAME = "修仙问答";
const SITE_URL = import.meta.env.VITE_SITE_URL || "https://xiuixian.app";
const DEFAULT_DESC =
  "修仙问答 —— 专属于高校学子的修仙主题问答社区。考研择校、四六级、考公考编、求职面试、宿舍生活、挂科逆袭，修仙路上的每一个疑问，都有学长学姐为你解答。下沉高校，同道共修。";
const DEFAULT_KEYWORDS =
  "修仙问答,高校问答,大学问答,考研,考研择校,四六级,考公,考编,求职面试,简历,宿舍生活,挂科,学长学姐,下沉市场,修真社区,大学生论坛";

type SeoProps = {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  /** 页面类型：website(默认) / article / qa */
  type?: "website" | "article" | "qa";
  /** 规范链接，默认取当前 path */
  canonical?: string;
  /** 是否禁止索引（如登录/私信页） */
  noindex?: boolean;
  /** JSON-LD 结构化数据对象（数组会自动包成多个 script） */
  jsonLd?: Record<string, any> | Record<string, any>[];
  /** 发布时间（article/qa 用） */
  datePublished?: string;
  author?: string;
};

function setMeta(prop: "name" | "property", key: string, content: string) {
  if (!content) return;
  let el = document.head.querySelector(
    `meta[${prop}="${key}"]`,
  ) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(prop, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector(
    `link[rel="${rel}"]`,
  ) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function setJsonLd(obj: Record<string, any>) {
  const id = "jsonld-" + (obj["@type"] || "data");
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(obj);
}

export function Seo({
  title,
  description = DEFAULT_DESC,
  keywords,
  image,
  type = "website",
  canonical,
  noindex,
  jsonLd,
}: SeoProps) {
  const fullTitle = title ? `${title} - ${SITE_NAME}` : `${SITE_NAME} - 修仙主题问答社区`;
  // canonical 支持相对路径（/question/123）→ 自动补全为绝对 URL，搜索引擎要求绝对 canonical
  const url = canonical
    ? (canonical.startsWith("http") ? canonical : `${SITE_URL}${canonical.startsWith("/") ? "" : "/"}${canonical}`)
    : (typeof window !== "undefined" ? window.location.href : SITE_URL);
  const ogImage = image || `${SITE_URL}/og-default.png`;

  useEffect(() => {
    document.title = fullTitle;
    setMeta("name", "description", description);
    if (keywords) setMeta("name", "keywords", keywords);
    else setMeta("name", "keywords", DEFAULT_KEYWORDS);
    setMeta("name", "robots", noindex ? "noindex,nofollow" : "index,follow");
    // Open Graph
    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", description);
    setMeta("property", "og:type", type === "website" ? "website" : "article");
    setMeta("property", "og:url", url);
    setMeta("property", "og:site_name", SITE_NAME);
    setMeta("property", "og:image", ogImage);
    // Twitter
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", fullTitle);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", ogImage);
    // 微信分享 (微信内 X5 内核走 OG)
    setMeta("property", "og:image:width", "1200");
    setMeta("property", "og:image:height", "630");
    // Canonical
    setLink("canonical", url);
    // JSON-LD
    if (jsonLd) {
      const arr = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      arr.forEach(setJsonLd);
    }
  }, [fullTitle, description, keywords, ogImage, type, url, noindex, jsonLd]);

  return null;
}

// 全站默认结构化数据（Organization），挂在 App 根部一次即可
export function SiteOrganizationJsonLd() {
  useEffect(() => {
    setJsonLd({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/favicon.svg`,
      description: DEFAULT_DESC,
      sameAs: [
        // 在此补充官方微博/公众号/知乎号等，提升品牌权威信号
      ],
    });
  }, []);
  return null;
}

// 生成 QAPage 结构化数据（百度/头条富结果核心）
export function qaJsonLd(opts: {
  questionId: string | number;
  title: string;
  text: string;
  answerTexts: string[];
  datePublished?: string;
  author?: string;
}) {
  const qUrl = `${SITE_URL}/question/${opts.questionId}`;
  return {
    "@context": "https://schema.org",
    "@type": "QAPage",
    mainEntity: {
      "@type": "Question",
      name: opts.title,
      text: opts.text,
      url: qUrl,
      dateCreated: opts.datePublished,
      author: opts.author ? { "@type": "Person", name: opts.author } : undefined,
      answerCount: opts.answerTexts.length,
      acceptedAnswer: opts.answerTexts[0]
        ? {
            "@type": "Answer",
            text: opts.answerTexts[0],
            upvoteCount: 0,
          }
        : undefined,
    },
  };
}

// ── Provider（仅做默认 JSON-LD 挂载，真正的 Seo 在页面各自调用） ──
const SeoCtx = createContext<boolean>(true);
export function SeoProvider({ children }: { children: ReactNode }) {
  return (
    <SeoCtx.Provider value={true}>
      <SiteOrganizationJsonLd />
      {children}
    </SeoCtx.Provider>
  );
}
export const useSeo = () => useContext(SeoCtx);

// 百度主动推送（新内容发布时调用，仅需在浏览器端、已登录时触发）
export async function pushToBaidu(urls: string[]) {
  const token = import.meta.env.VITE_BAIDU_PUSH_TOKEN;
  const site = import.meta.env.VITE_BAIDU_PUSH_SITE;
  if (!token || !site) return; // 未配置则跳过
  try {
    await fetch(`https://push.zhanzhang.baidu.com/api/urls?site=${site}&token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: urls.join("\n"),
    });
  } catch {
    /* 推送失败不影响主流程 */
  }
}
