import { useState, useEffect, useCallback } from 'react';
import { Megaphone, Plus, RefreshCw, Check, X, Store, Send } from 'lucide-react';
import { toast } from 'sonner';
import {
  listAllBoards, saveBoard, setBoardStatus, listAdPushes, createAdPush,
  adminListMerchants, adminReviewMerchant, listCampuses,
} from '@/lib/commerce';
import { formatTime } from '@/utils/format';

type Tab = 'boards' | 'merchants' | 'pushes';

/**
 * v23 R14 · 平台广告管理台
 * 展板位运营（创建官方位/上下线/定价）、商家审核、平台向商家广告推送
 */
export default function PlatformAdPage() {
  const [tab, setTab] = useState<Tab>('boards');
  const [boards, setBoards] = useState<any[]>([]);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [pushes, setPushes] = useState<any[]>([]);
  const [campuses, setCampuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [pushOpen, setPushOpen] = useState(false);
  const [form, setForm] = useState({ campus_id: 0, slot: 0, title: '', body: '', link: '', ends_at: '' });
  const [pushForm, setPushForm] = useState({ title: '', body: '', target_campus_id: 0, target_category: '', channel: 'inapp' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, m, p, c] = await Promise.all([
        listAllBoards('active'), adminListMerchants('pending'),
        listAdPushes(), listCampuses(),
      ]);
      setBoards(b); setMerchants(m); setPushes(p); setCampuses(c);
    } catch (e: any) {
      toast.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submitBoard = async () => {
    if (form.title.trim().length < 2) { toast.error('标题至少2个字'); return; }
    if (!form.campus_id) { toast.error('请选择校区'); return; }
    try {
      await saveBoard({
        campus_id: form.campus_id, slot: Number(form.slot) || 0, advertiser_type: 'platform',
        title: form.title.trim(), body: form.body, link: form.link,
        starts_at: new Date().toISOString(),
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : new Date(Date.now() + 30 * 864e5).toISOString(),
        status: 'active',
      }, true);
      toast.success('官方展位已上线');
      setNewOpen(false);
      setForm({ campus_id: 0, slot: 0, title: '', body: '', link: '', ends_at: '' });
      load();
    } catch (e: any) {
      toast.error(e?.message || '创建失败');
    }
  };

  const submitPush = async () => {
    if (pushForm.title.trim().length < 2) { toast.error('标题至少2个字'); return; }
    try {
      await createAdPush({
        title: pushForm.title.trim(), body: pushForm.body,
        targetCampusId: pushForm.target_campus_id || null,
        targetCategory: pushForm.target_category, channel: pushForm.channel,
      });
      toast.success('广告推送已创建（站内渠道即时送达）');
      setPushOpen(false);
      setPushForm({ title: '', body: '', target_campus_id: 0, target_category: '', channel: 'inapp' });
      load();
    } catch (e: any) {
      toast.error(e?.message || '创建失败');
    }
  };

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'boards', label: '展板管理', icon: Megaphone },
    { key: 'merchants', label: `商家审核${merchants.length > 0 ? ` (${merchants.length})` : ''}`, icon: Store },
    { key: 'pushes', label: '私域推送', icon: Send },
  ];

  const inp = 'w-full h-10 rounded-xl bg-gray-50 px-3 text-sm outline-none';

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="bg-white rounded-xl p-1 flex border border-gray-100">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 ${tab === t.key ? 'bg-orange-500 text-white' : 'text-gray-500'}`}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-gray-400">学校页私域广告展板运营：官方位优先，商家位按校区展示（平台收展位费）</p>
        <div className="flex gap-2">
          {tab === 'boards' && (
            <button onClick={() => setNewOpen(true)} className="h-8 px-3.5 rounded-full bg-orange-500 text-white text-xs font-medium flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> 官方展位
            </button>
          )}
          {tab === 'pushes' && (
            <button onClick={() => setPushOpen(true)} className="h-8 px-3.5 rounded-full bg-blue-600 text-white text-xs font-medium flex items-center gap-1">
              <Send className="w-3.5 h-3.5" /> 新建推送
            </button>
          )}
          <button onClick={load} className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 展板管理 */}
      {tab === 'boards' && (
        loading ? <div className="text-center py-16 text-gray-400 text-sm">加载中...</div> :
        boards.length === 0 ? (
          <div className="bg-white rounded-2xl text-center py-16 text-gray-400 text-sm border border-gray-100">暂无展板，点击「官方展位」创建</div>
        ) : (
          <div className="bg-white rounded-2xl divide-y divide-gray-50 overflow-hidden border border-gray-100">
            {boards.map((b: any) => (
              <div key={b.id} className="p-4">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${b.advertiser_type === 'platform' ? 'bg-orange-50 text-orange-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    {b.advertiser_type === 'platform' ? '平台官方' : `商家 · ${b.merchants?.shop_name || b.merchant_name || ''}`}
                  </span>
                  <span className="text-[10px] text-gray-400">槽位 #{b.slot}</span>
                  <span className="text-xs text-gray-400 ml-auto">{formatTime(new Date(b.created_at).getTime())}</span>
                </div>
                <div className="text-sm font-medium text-gray-800 mt-1.5">{b.title}</div>
                {b.body && <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{b.body}</div>}
                <div className="flex gap-2 mt-2.5">
                  <button onClick={() => setBoardStatus(b.id, 'paused').then(() => { toast.success('已暂停'); load(); })} className="h-7 px-3 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">暂停</button>
                  <button onClick={() => setBoardStatus(b.id, 'ended').then(() => { toast.success('已下线'); load(); })} className="h-7 px-3 rounded-full bg-red-50 text-red-500 text-xs font-medium">下线</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* 商家审核 */}
      {tab === 'merchants' && (
        loading ? <div className="text-center py-16 text-gray-400 text-sm">加载中...</div> :
        merchants.length === 0 ? (
          <div className="bg-white rounded-2xl text-center py-16 text-gray-400 text-sm border border-gray-100">暂无待审核商家</div>
        ) : (
          <div className="bg-white rounded-2xl divide-y divide-gray-50 overflow-hidden border border-gray-100">
            {merchants.map((m: any) => (
              <div key={m.id} className="p-4">
                <div className="text-sm font-semibold text-gray-800">{m.shop_name}</div>
                <div className="text-xs text-gray-500 mt-0.5">{m.category} · {m.address || '校内'} · 申请人：{m.profiles?.nickname || '未知'}</div>
                {m.description && <div className="text-xs text-gray-500 mt-1 line-clamp-2">{m.description}</div>}
                <div className="flex gap-2 mt-2.5">
                  <button onClick={() => adminReviewMerchant(m.id, true).then(() => { toast.success('已通过，商家可购买展板位'); load(); })} className="h-8 px-4 rounded-full bg-emerald-500 text-white text-xs font-medium flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> 通过
                  </button>
                  <button onClick={() => adminReviewMerchant(m.id, false, '资质不符').then(() => { toast.success('已拒绝'); load(); })} className="h-8 px-4 rounded-full bg-red-50 text-red-500 text-xs font-medium flex items-center gap-1">
                    <X className="w-3.5 h-3.5" /> 拒绝
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* 私域推送 */}
      {tab === 'pushes' && (
        pushes.length === 0 ? (
          <div className="bg-white rounded-2xl text-center py-16 text-gray-400 text-sm border border-gray-100">暂无推送记录</div>
        ) : (
          <div className="bg-white rounded-2xl divide-y divide-gray-50 overflow-hidden border border-gray-100">
            {pushes.map((p: any) => (
              <div key={p.id} className="p-4">
                <div className="text-sm font-medium text-gray-800">{p.title}</div>
                {p.body && <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{p.body}</div>}
                <div className="text-[11px] text-gray-400 mt-1.5">
                  {formatTime(new Date(p.created_at).getTime())} · 渠道：{p.channel}
                  {p.target_category ? ` · 类目：${p.target_category}` : ''}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* 创建官方展位 */}
      {newOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setNewOpen(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-bold text-gray-800 mb-1">创建官方展位</div>
            <div className="text-xs text-gray-400 mb-4">官方位（槽位 0）优先展示，商家位从 1 起</div>
            <div className="space-y-2.5">
              <select value={form.campus_id} onChange={(e) => setForm({ ...form, campus_id: Number(e.target.value) })} className={inp}>
                <option value={0}>选择校区 *</option>
                {(campuses || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="number" value={form.slot} onChange={(e) => setForm({ ...form, slot: Number(e.target.value) })} placeholder="槽位（0=官方位）" className={inp} />
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="标题 *" className={inp} />
              <input value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="文案（可选）" className={inp} />
              <input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="链接（可选）" className={inp} />
              <input type="date" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} className={inp} />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setNewOpen(false)} className="flex-1 h-10 rounded-full bg-gray-100 text-gray-600 text-sm font-medium">取消</button>
              <button onClick={submitBoard} className="flex-1 h-10 rounded-full bg-orange-500 text-white text-sm font-bold">上线展位</button>
            </div>
          </div>
        </div>
      )}

      {/* 新建推送 */}
      {pushOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setPushOpen(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-bold text-gray-800 mb-1">平台向商家发广告/通知</div>
            <div className="text-xs text-gray-400 mb-4">按校区/类目定向，站内渠道即时送达商家</div>
            <div className="space-y-2.5">
              <input value={pushForm.title} onChange={(e) => setPushForm({ ...pushForm, title: e.target.value })} placeholder="标题 *" className={inp} />
              <textarea value={pushForm.body} onChange={(e) => setPushForm({ ...pushForm, body: e.target.value })} rows={3} placeholder="正文（可选）" className="w-full rounded-xl bg-gray-50 px-3 py-2.5 text-sm outline-none resize-none" />
              <select value={pushForm.target_campus_id} onChange={(e) => setPushForm({ ...pushForm, target_campus_id: Number(e.target.value) })} className={inp}>
                <option value={0}>全部校区</option>
                {(campuses || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input value={pushForm.target_category} onChange={(e) => setPushForm({ ...pushForm, target_category: e.target.value })} placeholder="类目定向（如：餐饮，留空=全部）" className={inp} />
              <select value={pushForm.channel} onChange={(e) => setPushForm({ ...pushForm, channel: e.target.value })} className={inp}>
                <option value="inapp">站内</option>
                <option value="sms">短信</option>
                <option value="wecom">企微</option>
              </select>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setPushOpen(false)} className="flex-1 h-10 rounded-full bg-gray-100 text-gray-600 text-sm font-medium">取消</button>
              <button onClick={submitPush} className="flex-1 h-10 rounded-full bg-blue-600 text-white text-sm font-bold">发送推送</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
