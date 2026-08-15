import { usePageTitle } from '@/hooks/usePageTitle';
import PageHeader from '@/components/PageHeader';
import { Seo } from '@/components/Seo';
import { Download, Smartphone, ShieldCheck } from 'lucide-react';

const APK_URL = 'https://github.com/mazhenzhou1996/xiuixian-app/releases/latest';

export default function DownloadPage() {
  usePageTitle('下载 App');
  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <Seo title="下载修仙问答 App - 修仙问答" noindex />
      <PageHeader title="下载 App" />
      <div className="px-4 py-6">
        <div className="bg-white rounded-2xl p-6 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[#0084FF] flex items-center justify-center mb-4">
            <Smartphone className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">修仙问答 Android 版</h2>
          <p className="text-xs text-gray-400 mt-1 mb-5">当前版本 v38 · 2026-08-15 · 约 4.8MB</p>
          <a
            href={APK_URL}
            target="_blank"
            rel="noreferrer"
            className="w-full h-12 rounded-xl bg-[#0084FF] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-[#0084FF]/25 hover:bg-[#0066CC] active:scale-[0.98] transition-all"
          >
            <Download className="w-4 h-4" />
            下载 APK（Android）
          </a>
          <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-gray-400">
            <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
            官方渠道发布 · 安装时请允许"未知来源"
          </div>
          <div className="mt-5 pt-4 border-t border-gray-100 text-left space-y-1.5">
            <div className="text-[11px] text-gray-400">安装说明：</div>
            <ol className="text-xs text-gray-500 space-y-1 list-decimal pl-4">
              <li>点击上方按钮下载 APK 文件</li>
              <li>在手机文件管理器中打开该文件</li>
              <li>按提示允许"安装未知来源应用"</li>
              <li>安装完成后用邮箱登录即可</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
