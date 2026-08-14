import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, Paperclip, Lock, ExternalLink, Loader2, School } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useXiuxianStore } from '@/store/useStore';
import { publicTopic } from '@/lib/adminapi';
import { playRewardedAd } from '@/lib/adprovider';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

export default function ServiceContentPage() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const store = useXiuxianStore();
  const [school] = useState<any>(() => store.getSelectedSchool());
  const [service, setService] = useState<any>(null);
  usePageTitle(service?.label || '服务详情');
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [watching, setWatching] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const svc = await publicTopic.getServiceById(Number(serviceId));
        setService(svc);
        // 学校 id 兜底：本地常量无 id 时按名称查数据库
        let uniId = school?.id;
        if (!uniId && school?.name) {
          const unis = await publicTopic.getUniversities();
          const found = unis.find((u: any) => u.name === school.name);
          uniId = found?.id;
        }
        if (uniId) {
          const c = await publicTopic.getServiceContent(uniId, Number(serviceId));
          setContent(c);
        }
      } catch { /* ignore */ }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, school?.id]);

  const handleWatch = async () => {
    setWatching(true);
    const ok = await playRewardedAd();
    setWatching(false);
    if (ok) setUnlocked(true);
  };

  const openNetdisk = () => {
    if (!content?.netdisk_url) return;
    window.open(content.netdisk_url, '_blank');
    setUnlockOpen(false);
    setUnlocked(false);
  };

  if (!school) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="服务详情" />
        <div className="text-center py-20">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
            <School className="w-6 h-6 text-gray-300" />
          </div>
          <p className="text-sm text-gray-400 mb-4">请先在专题页选择学校</p>
          <button
            onClick={() => navigate('/topic/university')}
            className="px-6 py-2 bg-blue-600 text-white text-sm rounded-full"
          >
            去选学校
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-4">
      <PageHeader title={service?.label || '服务详情'} />

      <div className="px-4 py-3 space-y-3">
        {/* 学校信息条 */}
        <div className="bg-white rounded-xl px-4 py-3 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
            <School className="w-4.5 h-4.5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-800">{school.name}</div>
            <div className="text-[11px] text-gray-400">{(school.tags || []).join(' · ') || school.province || ''}</div>
          </div>
          <button
            onClick={() => navigate('/topic/university')}
            className="shrink-0 h-7 px-3 rounded-full bg-gray-100 text-gray-500 text-xs font-medium"
          >
            切换
          </button>
        </div>

        {/* 内容 */}
        <div className="bg-white rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
            <FileText className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-gray-800">{service?.label || '服务详情'}</span>
          </div>
          {loading ? (
            <div className="p-10 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> 加载中...
            </div>
          ) : (
            <div className="px-4 py-4 text-sm text-gray-700 leading-relaxed whitespace-pre-line min-h-[120px]">
              {content?.content ? content.content : '暂无内容，敬请期待'}
            </div>
          )}
        </div>

        {/* 附件(网盘链接,看广告解锁) */}
        <div className="bg-white rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Paperclip className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-semibold text-gray-800">附件</span>
          </div>
          {content?.netdisk_url ? (
            content?.ad_unlock ? (
              <button
                onClick={() => setUnlockOpen(true)}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-medium shadow-md shadow-orange-100 flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                观看广告解锁网盘链接
              </button>
            ) : (
              <a
                href={content.netdisk_url}
                target="_blank"
                rel="noreferrer"
                className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-medium shadow-md shadow-emerald-100 flex items-center justify-center gap-2"
              >
                <Paperclip className="w-4 h-4" />
                直接打开网盘链接
              </a>
            )
          ) : (
            <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-xs text-gray-400 text-center">
              暂无附件
            </div>
          )}
        </div>
      </div>

      {/* 广告解锁弹窗 */}
      <Dialog open={unlockOpen} onOpenChange={(o) => { if (!o) { setUnlockOpen(false); setUnlocked(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-orange-500" />
              解锁网盘链接
            </DialogTitle>
            <DialogDescription>观看一段广告即可免费解锁资源链接</DialogDescription>
          </DialogHeader>
          {!unlocked ? (
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-6 text-center">
              {watching ? (
                <div className="py-4">
                  <Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto mb-3" />
                  <div className="text-sm text-gray-600">广告播放中，请完整观看...</div>
                  <div className="text-[11px] text-gray-400 mt-1">中途关闭将无法解锁</div>
                </div>
              ) : (
                <button
                  onClick={handleWatch}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-bold shadow-md shadow-orange-200 hover:from-orange-600 hover:to-amber-600 transition-all active:scale-[0.98]"
                >
                  观看广告解锁
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-xl bg-green-50 border border-green-100 p-6 text-center">
              <div className="text-2xl mb-2">🎉</div>
              <div className="text-sm text-gray-700 font-medium mb-3">解锁成功！感谢观看广告</div>
              <button
                onClick={openNetdisk}
                className="w-full h-12 rounded-xl bg-green-600 text-white text-sm font-bold shadow-md shadow-green-200 hover:bg-green-700 transition-all flex items-center justify-center gap-1.5"
              >
                <ExternalLink className="w-4 h-4" />
                打开网盘链接
              </button>
            </div>
          )}
          <DialogFooter>
            <button onClick={() => { setUnlockOpen(false); setUnlocked(false); }} className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">
              取消
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
