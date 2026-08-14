import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, Flag, Check, Coins, Image as ImageIcon, Video, Loader2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Avatar from '@/components/Avatar';
import ConsultationDialog from '@/components/consultationdialog';
import { useXiuxianStore } from '@/store/useStore';
import { api } from '@/lib/api';
import { formatTime } from '@/utils/format';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';
import { supabase } from '@/lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const REASONS = ['骚扰/辱骂', '广告/营销', '违法违规', '其他'];

export default function PrivateChatPage() {
  const { userId = '' } = useParams<{ userId: string }>();
  usePageTitle('私信');
  const navigate = useNavigate();
  const store = useXiuxianStore();
  const currentUser = store.getCurrentUser();
  const [input, setInput] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMsg, setReportMsg] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<string>(REASONS[0]);
  const [consultOpen, setConsultOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 登录态探测：用 Supabase session 判断，取代旧的 localStorage 'token' 判断
  const [authState, setAuthState] = useState<'loading' | 'auth' | 'guest'>('loading');
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (alive) setAuthState(data.user ? 'auth' : 'guest');
    });
    return () => { alive = false; };
  }, []);

  const user = store.getUserById(userId);
  const peerName = user?.nickname || '道友';
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUser?.id) return;
    const meId = currentUser.id;
    let alive = true;
    // 初始仅拉取一次
    store.getPmMessages(userId).then((list) => { if (alive) setMessages(list); });
    api.markPmRead(userId).catch(() => {});
    // 改用 Supabase Realtime 推送，取代 5 秒轮询：
    // 聊天请求从「每分钟 12 次/人」降到「仅消息事件（走 Realtime 消息额度，不占 API 请求）」，
    // 是免费档支撑百人在线私信的关键优化。
    const channel = supabase
      .channel(`pm:${meId}:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'private_messages',
          filter: `or(sender_id.eq.${meId},receiver_id.eq.${meId})`,
        },
        (payload: any) => {
          const nw = payload.new;
          const otherId =
            String(nw.sender_id) === String(meId)
              ? String(nw.receiver_id)
              : String(nw.sender_id);
          if (otherId !== userId) return; // 非当前会话，忽略
          setMessages((prev) => {
            if (prev.some((m) => String(m.id) === String(nw.id))) return prev;
            return [
              ...prev,
              {
                id: String(nw.id),
                from: String(nw.sender_id) === String(meId) ? 'me' : 'other',
                content: nw.content,
                type: nw.msg_type || 'text',
                time: new Date(nw.created_at).getTime(),
              },
            ];
          });
          api.markPmRead(userId).catch(() => {});
        },
      )
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, currentUser?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, refreshKey]);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="私信" />
        {authState !== 'guest' ? (
          <div className="text-center py-20 text-gray-400 text-sm">加载中...</div>
        ) : (
          <div className="text-center py-20">
            <p className="text-sm text-gray-400 mb-4">登录后使用私信</p>
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-2 bg-blue-600 text-white text-sm rounded-full"
            >
              去登录
            </button>
          </div>
        )}
      </div>
    );
  }

  const handleSend = async () => {
    const content = input.trim();
    if (!content) return;
    try {
      await store.sendPmMessage(userId, content);
      const list = await store.getPmMessages(userId);
      setMessages(list);
      setInput('');
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      toast.error(err?.message || '发送失败，请重试');
    }
  };

  // v20：发送图片/视频（先上传 Storage，再发带类型的消息）
  const handleSendMedia = async (e: React.ChangeEvent<HTMLInputElement>, kind: 'image' | 'video') => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (kind === 'image' && !file.type.startsWith('image/')) { toast.error('请选择图片文件'); return; }
    if (kind === 'video' && !file.type.startsWith('video/')) { toast.error('请选择视频文件'); return; }
    setUploading(true);
    try {
      const url = kind === 'image' ? await api.uploadImage(file) : await api.uploadVideo(file);
      await store.sendPmMessage(userId, url, kind);
      const list = await store.getPmMessages(userId);
      setMessages(list);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      toast.error(err?.message || '发送失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  const handleReport = async () => {
    setReportOpen(false);
    const idx = Number(reportMsg);
    const target = messages[idx];
    try {
      await api.submitReport({
        targetType: 'message',
        targetId: target?.id ? String(target.id) : userId,
        targetUserId: userId,
        reason: reportReason,
        content: target?.content || '',
      });
      toast.success('举报已提交，我们会尽快处理');
    } catch (err: any) {
      toast.error(err?.message || '举报提交失败，请重试');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <PageHeader
        title={peerName}
        rightAction={
          <button
            onClick={() => setReportOpen(true)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500"
          >
            <Flag className="w-4 h-4" />
            举报
          </button>
        }
      />

      {/* 付费咨询提醒条(醒目) */}
      <div className="px-4 pt-3">
        <button
          onClick={() => setConsultOpen(true)}
          className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-3 flex items-center gap-2.5 shadow-md shadow-orange-200 hover:from-amber-600 hover:to-orange-600 transition-all active:scale-[0.99]"
        >
          <Coins className="w-5 h-5 shrink-0" />
          <div className="text-left flex-1 min-w-0">
            <div className="text-sm font-bold">向{peerName}付费咨询</div>
            <div className="text-[11px] text-amber-100">一对一深度解答，不满意可举报退款</div>
          </div>
          <span className="text-xs bg-white/20 rounded-full px-3 py-1 shrink-0">立即咨询</span>
        </button>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 px-4 py-3 space-y-3 overflow-y-auto">
        {messages.length === 0 && (
          <div className="text-center py-16 text-gray-400 text-sm">
            还没有消息，说点什么吧
          </div>
        )}
        {messages.map((m: any, i: number) => (
          <div key={i} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
            {m.from !== 'me' && (
              <Avatar src="" alt={peerName} className="w-8 h-8 mr-2 mt-auto" bgClass="bg-gradient-to-br from-indigo-500 to-purple-500" />
            )}
            <div className={`max-w-[70%] ${m.from === 'me' ? 'bg-blue-600 text-white' : 'bg-white text-gray-800 border border-gray-100'}`}>
              {m.type === 'image' ? (
                <img
                  src={m.content}
                  alt="图片消息"
                  loading="lazy"
                  onClick={() => window.open(m.content, '_blank')}
                  className="max-w-[220px] rounded-2xl cursor-zoom-in block"
                />
              ) : m.type === 'video' ? (
                <video
                  src={m.content}
                  controls
                  preload="metadata"
                  className="max-w-[240px] max-h-64 rounded-2xl block"
                />
              ) : (
                <div className="px-3.5 py-2.5 text-sm leading-relaxed rounded-2xl">{m.content}</div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 输入栏（v20：图片/视频 + 文本；pb-safe 防遮挡） */}
      <div className="bg-white border-t border-gray-100 px-3 py-2.5 pb-safe flex items-end gap-2">
        <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleSendMedia(e, 'image')} />
        <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={(e) => handleSendMedia(e, 'video')} />
        <button
          onClick={() => imgRef.current?.click()}
          disabled={uploading}
          className="shrink-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-blue-50 hover:text-blue-600 transition-colors disabled:opacity-50"
          title="发送图片"
        >
          <ImageIcon className="w-5 h-5 text-gray-500" />
        </button>
        <button
          onClick={() => videoRef.current?.click()}
          disabled={uploading}
          className="shrink-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-purple-50 hover:text-purple-600 transition-colors disabled:opacity-50"
          title="发送视频"
        >
          <Video className="w-5 h-5 text-gray-500" />
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
          placeholder={uploading ? '上传中...' : `发给 ${peerName}...`}
          className="flex-1 h-10 px-3 bg-gray-100 rounded-full text-sm outline-none focus:ring-2 focus:ring-blue-200"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || uploading}
          className="h-10 px-4 bg-blue-600 text-white text-sm font-medium rounded-full disabled:opacity-40 flex items-center gap-1"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {uploading ? '上传' : '发送'}
        </button>
      </div>

      {/* 付费咨询弹窗 */}
      {consultOpen && (
        <ConsultationDialog expertId={userId} expertName={peerName} onClose={() => setConsultOpen(false)} />
      )}

      {/* 举报弹窗（可选择上下文 + 原因） */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>举报对话</DialogTitle>
            <DialogDescription>
              选择要举报的消息（上下文）和原因，提交后我们会尽快处理。
            </DialogDescription>
          </DialogHeader>

          {/* 上下文选择：最近的消息 */}
          <div className="text-xs text-gray-400 mb-1.5">选择举报的消息上下文</div>
          <div className="max-h-44 overflow-y-auto space-y-1.5 mb-3">
            {messages.length === 0 && (
              <div className="text-center py-4 text-xs text-gray-400">暂无消息可举报</div>
            )}
            {messages.slice(-6).reverse().map((m: any, i: number) => {
              const idx = messages.length - 1 - i;
              const selected = reportMsg === String(idx);
              return (
                <div
                  key={idx}
                  onClick={() => setReportMsg(String(idx))}
                  className={`flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                    selected ? 'border-red-300 bg-red-50' : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${selected ? 'border-red-500' : 'border-gray-300'}`}>
                    {selected && <Check className="w-2.5 h-2.5 text-red-500" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] text-gray-400">{m.from === 'me' ? '我' : peerName} · {formatTime(m.time)}</div>
                    <div className="text-xs text-gray-700 line-clamp-2 mt-0.5">{m.content}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 原因选择 */}
          <div className="text-xs text-gray-400 mb-1.5">举报原因</div>
          <div className="flex flex-wrap gap-2 mb-2">
            {REASONS.map((r) => (
              <button
                key={r}
                onClick={() => setReportReason(r)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  reportReason === r
                    ? 'bg-red-500 text-white border-red-500'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <DialogFooter>
            <button
              onClick={() => setReportOpen(false)}
              className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full"
            >
              取消
            </button>
            <button
              onClick={handleReport}
              disabled={!reportMsg}
              className="h-9 px-6 bg-red-500 text-white text-sm font-medium rounded-full disabled:opacity-40"
            >
              提交举报
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
