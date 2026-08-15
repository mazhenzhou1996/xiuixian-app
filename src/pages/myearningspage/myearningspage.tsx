import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, MessageSquare, Trophy, Wallet, ArrowLeft, Loader2, Save } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useXiuxianStore } from '@/store/useStore';
import { api } from '@/lib/api';
import { getCurrentUserId } from '@/lib/supabase';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toast } from 'sonner';

export default function MyEarningsPage() {
  usePageTitle('我的收益');
  const navigate = useNavigate();
  const store = useXiuxianStore();
  const [earnings, setEarnings] = useState<any>(null);

  // 我的咨询定价（从付费功能页移入）
  const [price, setPrice] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    store.getMyEarnings().then(setEarnings).catch(() => toast.error('收益数据加载失败'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const uid = await getCurrentUserId();
        if (uid) {
          const s = await api.getConsultationSetting(uid);
          setPrice(s?.price || 0);
          setEnabled(s?.enabled !== false);
        }
      } catch { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSetting = async () => {
    setSaving(true);
    try {
      await api.saveConsultationSetting(price, enabled);
      toast.success('咨询设置已保存');
    } catch (e: any) {
      toast.error(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const items = [
    { icon: Coins, label: '赞赏收入', value: earnings?.tip_income || 0, sub: `${earnings?.tip_count || 0} 笔赞赏`, color: 'text-amber-500 bg-amber-50' },
    { icon: MessageSquare, label: '咨询收入', value: earnings?.consult_income || 0, sub: '付费咨询累计', color: 'text-blue-500 bg-blue-50' },
    { icon: Trophy, label: '悬赏收入', value: earnings?.bounty_income || 0, sub: '悬赏分红累计', color: 'text-purple-500 bg-purple-50' },
    { icon: Wallet, label: '当前余额', value: earnings?.balance || 0, sub: '可用于咨询/赞赏/悬赏', color: 'text-green-500 bg-green-50' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="我的收益" />
      <div className="px-4 py-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {items.map((it) => (
            <div key={it.label} className="bg-white rounded-xl p-4">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${it.color}`}>
                <it.icon className="w-5 h-5" />
              </div>
              <div className="text-lg font-bold text-gray-900">¥{it.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{it.label}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">{it.sub}</div>
            </div>
          ))}
        </div>

        {/* 我的咨询定价（移入我的收益） */}
        <div className="bg-white rounded-xl p-4">
          <div className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-amber-500" /> 我的咨询定价
          </div>
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-sm text-gray-600 shrink-0">单次咨询价格</span>
            <div className="flex items-center flex-1">
              <span className="text-lg font-bold text-amber-600">¥</span>
              <input
                type="number"
                min={0}
                max={9999}
                value={price}
                onChange={(e) => setPrice(Number(e.target.value) || 0)}
                className="flex-1 h-10 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-amber-300 mx-2"
              />
              <span className="text-xs text-gray-400 shrink-0">元/次</span>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 mb-3">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="w-4 h-4" />
            开通付费咨询（价格为 0 视为未开通）
          </label>
          <button
            onClick={saveSetting}
            disabled={saving}
            className="w-full h-10 rounded-xl bg-amber-500 text-white text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-1"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 保存设置
          </button>
          <button
            onClick={() => navigate('/consult-center')}
            className="w-full mt-2 text-center text-[11px] text-gray-400 hover:text-amber-600"
          >
            前往付费功能（充值 / 收支详情）→
          </button>
        </div>

        <div className="bg-white rounded-xl p-4">
          <div className="text-sm font-medium text-gray-700 mb-1">收益说明</div>
          <div className="text-xs text-gray-500 leading-relaxed space-y-1.5">
            <p>· 赞赏收入：其他道友对你的回答进行赞赏（余额实时入账，单笔 1-100 元）</p>
            <p>· 咨询收入：付费咨询订单结算金额</p>
            <p>· 悬赏收入：悬赏榜认可分红（70% 归答主）</p>
            <p>· 余额上限 100 元，可在「我的」查看明细流水</p>
          </div>
          <button
            onClick={() => navigate('/profile')}
            className="mt-3 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            返回我的主页
          </button>
        </div>
      </div>
    </div>
  );
}
