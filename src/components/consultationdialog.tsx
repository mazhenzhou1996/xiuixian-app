import { useState, useEffect } from 'react';
import { Loader2, Coins, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

export default function ConsultationDialog({ expertId, expertName, onClose }: {
  expertId: string;
  expertName?: string;
  onClose: () => void;
}) {
  const [setting, setSetting] = useState<any>(null);
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.getConsultationSetting(expertId).then(setSetting).catch(() => {});
  }, [expertId]);

  const handleSubmit = async () => {
    if (question.trim().length < 5) {
      toast.error('咨询内容至少 5 个字');
      return;
    }
    setSubmitting(true);
    try {
      await api.createConsultation(expertId, question.trim());
      setDone(true);
    } catch (e: any) {
      toast.error(e.message || '发起失败');
    } finally {
      setSubmitting(false);
    }
  };

  const price = setting?.price || 0;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-amber-500" />
            付费咨询 {expertName ? `· ${expertName}` : ''}
          </DialogTitle>
          <DialogDescription>一对一咨询，付款后答主将为你解答</DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="rounded-xl bg-green-50 border border-green-100 p-6 text-center">
            <div className="text-2xl mb-2">✅</div>
            <div className="text-sm text-gray-700 font-medium mb-1">咨询已提交并付款</div>
            <div className="text-xs text-gray-400">答主回复后可在「我的 → 付费功能」中查看</div>
          </div>
        ) : (
          <>
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-700">咨询费用</span>
              <span className="text-lg font-bold text-amber-600">¥{price}</span>
            </div>
            <textarea
              className="w-full h-28 rounded-xl border border-gray-200 p-3 text-sm outline-none focus:border-amber-300"
              placeholder={`向${expertName || '对方'}咨询什么？请描述你的问题（至少 5 个字）`}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <div className="text-[11px] text-gray-400">
              付款后费用直接转入答主账户；对回复不满意可在咨询记录中举报，管理员核实后全额退款。
            </div>
          </>
        )}

        <DialogFooter>
          <button onClick={onClose} className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">
            {done ? '关闭' : '取消'}
          </button>
          {!done && (
            <button
              onClick={handleSubmit}
              disabled={submitting || price <= 0}
              className="h-9 px-6 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium rounded-full disabled:opacity-40 flex items-center gap-1"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              确认支付 ¥{price}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
