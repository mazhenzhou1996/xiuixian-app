import { usePageTitle } from '@/hooks/usePageTitle';
import PageHeader from '@/components/PageHeader';
import { Seo } from '@/components/Seo';

const VERSIONS = [
  { v: 'v36', date: '2026-08-15', items: ['上线优化：自动部署、CSP 安全头、robots 域名修复', '页脚版本号', '隐私政策 / 用户协议 / 版本日志 / 下载页'] },
  { v: 'v35', date: '2026-08-15', items: ['底部导航常驻并调小 30%', '顶部热榜行加高 50%、字变大、均匀分布', '搜索行随滚动隐藏，热榜行吸顶', '本校圈子增高 30%'] },
  { v: 'v34', date: '2026-08-15', items: ['Android 返回键：有历史返回上一页，首页才退出', '顶部导航精简（去 logo/铃铛/头像）', '通知未读数迁移到底部导航「我的」', '大学专题道友榜收进付费咨询行'] },
  { v: 'v33', date: '2026-08-15', items: ['注册/登录改为邮箱，移除演示账号', '精选故事并入表白墙', '知乎蓝主题横幅', '学校九宫格全部展开'] },
  { v: 'v31', date: '2026-08-15', items: ['表白墙：双方确认关系流 + 精选故事 + 续写后续', '后台表白墙管理', 'Android 工程与 APK 构建流水线'] },
  { v: 'v29', date: '2026-08-14', items: ['全量上线：公开注册 + 管理后台'] },
];

export default function ChangelogPage() {
  usePageTitle('版本日志');
  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <Seo title="版本日志 - 修仙问答" noindex />
      <PageHeader title="版本日志" />
      <div className="px-4 py-4 space-y-3">
        {VERSIONS.map((x) => (
          <div key={x.v} className="bg-white rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-bold text-[#0084FF]">{x.v}</span>
              <span className="text-xs text-gray-400">{x.date}</span>
            </div>
            <ul className="space-y-1">
              {x.items.map((it, i) => (
                <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                  <span className="text-[#0084FF] shrink-0">·</span>{it}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
