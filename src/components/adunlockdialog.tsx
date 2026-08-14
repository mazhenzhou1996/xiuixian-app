import { useState } from 'react';
import { Play, Loader2, ExternalLink, Lock } from 'lucide-react';
import { playRewardedAd } from '@/lib/adprovider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function AdUnlockDialog({ service, onClose }: { service: any; onClose: () => void }) {
  const [watching, setWatching] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  const handleWatch = async () => {
    setWatching(true);
    const ok = await playRewardedAd();
    setWatching(false);
    if (ok) {
      setUnlocked(true);
    }
  };

  const handleOpen = () => {
    if (!service?.url) return;
    if (service.url.startsWith('/')) {
      // 站内路径由页面处理；此处直接新窗口打开相对路径由调用方处理
      window.location.hash = service.url;
    } else {
      window.open(service.url, '_blank');
    }
    onClose();
    setUnlocked(false);
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) { onClose(); setUnlocked(false); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-orange-500" />
            「{service?.label}」需要解锁
          </DialogTitle>
          <DialogDescription>观看一段广告即可免费解锁资源链接，支持我们持续更新内容</DialogDescription>
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
              <>
                <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-orange-100 flex items-center justify-center">
                  <Play className="w-6 h-6 text-orange-500" />
                </div>
                <button
                  onClick={handleWatch}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-bold shadow-md shadow-orange-200 hover:from-orange-600 hover:to-amber-600 transition-all active:scale-[0.98]"
                >
                  观看广告解锁
                </button>
                <div className="text-[11px] text-gray-400 mt-2.5">解锁后可直接打开资源链接</div>
              </>
            )}
          </div>
        ) : (
          <div className="rounded-xl bg-green-50 border border-green-100 p-6 text-center">
            <div className="text-2xl mb-2">🎉</div>
            <div className="text-sm text-gray-700 font-medium mb-3">解锁成功！感谢观看广告</div>
            <button
              onClick={handleOpen}
              className="w-full h-12 rounded-xl bg-green-600 text-white text-sm font-bold shadow-md shadow-green-200 hover:bg-green-700 transition-all flex items-center justify-center gap-1.5"
            >
              <ExternalLink className="w-4 h-4" />
              打开{service?.label}
            </button>
          </div>
        )}

        <DialogFooter>
          <button
            onClick={() => { onClose(); setUnlocked(false); }}
            className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full"
          >
            {unlocked ? '稍后打开' : '取消'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
