import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { School, Trophy, ChevronRight, BadgeCheck, ShieldCheck, Users, Loader2, Store, Megaphone, Heart, PackageSearch, Crown, LayoutGrid, ChevronDown } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useXiuxianStore } from '@/store/useStore';
import { api } from '@/lib/api';
import { listAdBoards, listCampuses, listMerchantsByCampus, applyMerchant, getMyMerchant, buyBoardSlot, getConfig } from '@/lib/commerce';
import { publicTopic } from '@/lib/adminapi';
import { listConfessions, listLostItems, listBeautyActivities } from '@/lib/features';
import { ServiceIcon } from '@/lib/iconmap';
import AdBoard from '@/components/adboard';
import Avatar from '@/components/Avatar';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

export default function SchoolCirclePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const store = useXiuxianStore();
  const [school, setSchool] = useState<any>(null);
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  // v18：学校认证
  const [myVerify, setMyVerify] = useState<any>(null);
  const [verifiedMembers, setVerifiedMembers] = useState<any[]>([]);
  const [applying, setApplying] = useState(false);
  // v23：私域广告展板 + 商家
  const [boards, setBoards] = useState<any[]>([]);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [myMerchant, setMyMerchant] = useState<any>(null);
  const [merchantOpen, setMerchantOpen] = useState(false);
  const [merchantForm, setMerchantForm] = useState({ shop_name: '', category: '餐饮', description: '', address: '' });
  const [merchantBusy, setMerchantBusy] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [buyForm, setBuyForm] = useState({ slot: 1, duration: 'monthly', title: '', body: '', link: '' });
  const [buyBusy, setBuyBusy] = useState(false);
  const [boardPrice, setBoardPrice] = useState<any>(null);
  // v28：本校表白墙/失物/评选 + 九宫格折叠
  const [wallItems, setWallItems] = useState<any[]>([]);
  const [lostItems, setLostItems] = useState<any[]>([]);
  const [campusBeauty, setCampusBeauty] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [gridExpanded, setGridExpanded] = useState(false);
  // v28b：本校悬赏
  const [campusBounties, setCampusBounties] = useState<any[]>([]);

  usePageTitle(school ? `${school.name} · 本校圈子` : '学校圈子');

  useEffect(() => {
    if (!id) return;
    store.listSchools().then((list: any[]) => {
      const s = (list || []).find((x: any) => x.id === Number(id));
      setSchool(s || null);
    }).catch(() => {});
    loadMore(true);
    // v18：认证状态 + 认证修士榜
    if (store.getCurrentUser()) {
      api.getMyVerification().then(setMyVerify).catch(() => {});
    }
    api.listVerifiedMembers(Number(id), 20).then(setVerifiedMembers).catch(() => {});
    // v23：展板 + 商家（按学校关联校区；未建校区时展板为空不报错）
    listCampuses().then((list: any[]) => {
      const c = (list || []).find((x: any) => x.university_id === Number(id));
      if (c) {
        listAdBoards(c.id).then(setBoards).catch(() => {});
        listMerchantsByCampus(c.id).then(setMerchants).catch(() => {});
      }
    }).catch(() => {});
    getMyMerchant().then(setMyMerchant).catch(() => {});
    getConfig('board_price').then(setBoardPrice).catch(() => {});
    // v28：本校表白墙/失物/评选 + 九宫格
    listConfessions(3, 0, Number(id)).then(setWallItems).catch(() => {});
    listLostItems('all', 3, 0, Number(id)).then(setLostItems).catch(() => {});
    listBeautyActivities().then((list: any[]) => {
      const a = (list || []).find((x: any) => x.scope === 'campus' && x.status === 'active');
      if (a) setCampusBeauty(a);
    }).catch(() => {});
    publicTopic.getServices('university').then((list: any[]) => setServices(list || [])).catch(() => {});
    // v28b：本校悬赏（按校区过滤）
    listCampuses().then((list: any[]) => {
      const c = (list || []).find((x: any) => x.university_id === Number(id));
      if (c) {
        import('@/lib/features').then(({ listBountiesV2 }) =>
          listBountiesV2('all', 50).then((rows: any[]) => {
            setCampusBounties((rows || []).filter((b: any) => b.campus_id === c.id).slice(0, 3));
          }).catch(() => {})
        ).catch(() => {});
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const submitMerchant = async () => {
    if (merchantForm.shop_name.trim().length < 2) { toast.error('店铺名称至少2个字'); return; }
    setMerchantBusy(true);
    try {
      const res = await applyMerchant({ shopName: merchantForm.shop_name.trim(), category: merchantForm.category, description: merchantForm.description.trim(), address: merchantForm.address.trim() });
      toast.success(res?.status === 'approved' ? '商家入驻成功，现在可以购买展板位了' : '入驻申请已提交，等待审核');
      setMerchantOpen(false);
      getMyMerchant().then(setMyMerchant).catch(() => {});
    } catch (e: any) {
      toast.error(e?.message || '入驻失败');
    } finally {
      setMerchantBusy(false);
    }
  };

  const submitBuyBoard = async () => {
    if (!id) return;
    if (buyForm.title.trim().length < 2) { toast.error('展位标题至少2个字'); return; }
    setBuyBusy(true);
    try {
      const c = await listCampuses();
      const campus = (c || []).find((x: any) => x.university_id === Number(id));
      if (!campus) { toast.error('该校暂未开通展板位'); return; }
      const res = await buyBoardSlot({
        campusId: campus.id, slot: Number(buyForm.slot) || 1, duration: buyForm.duration as any,
        title: buyForm.title.trim(), body: buyForm.body.trim(), link: buyForm.link.trim(),
      });
      toast.success(`购买成功：展位 #${res?.board_id}，¥${res?.price}，${res?.days} 天`);
      setBuyOpen(false);
      setBuyForm({ slot: 1, duration: 'monthly', title: '', body: '', link: '' });
      const c2 = await listCampuses();
      const campus2 = (c2 || []).find((x: any) => x.university_id === Number(id));
      if (campus2) listAdBoards(campus2.id).then(setBoards).catch(() => {});
    } catch (e: any) {
      toast.error(e?.message || '购买失败');
    } finally {
      setBuyBusy(false);
    }
  };

  const applyVerify = async () => {
    if (!store.getCurrentUser()) {
      toast.info('请先登录');
      navigate('/login');
      return;
    }
    if (!id) return;
    if (!window.confirm(`申请认证为「${school?.name || ''}」的修士？认证需后台审核，通过后获得认证标识，可在付费咨询中接单。`)) return;
    setApplying(true);
    try {
      await api.applySchoolVerification(Number(id), '');
      toast.success('认证申请已提交，等待后台审核');
      const v = await api.getMyVerification();
      setMyVerify(v);
    } catch (e: any) {
      toast.error(e?.message || '申请失败');
    } finally {
      setApplying(false);
    }
  };

  const loadMore = async (reset = false) => {
    if (!id) return;
    const nextOffset = reset ? 0 : offset;
    setLoading(true);
    try {
      const rows = await store.getSchoolFeed(Number(id), nextOffset, 20);
      if (reset) {
        setFeed(rows || []);
        setOffset(20);
      } else {
        setFeed((prev) => [...prev, ...(rows || [])]);
        setOffset(nextOffset + 20);
      }
      setHasMore((rows || []).length === 20);
    } catch {
      toast.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <PageHeader title="学校圈子" />

      {/* 学校信息卡 */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-500 px-4 py-6 text-white">
        <div className="flex items-center gap-2 mb-1">
          <School className="w-5 h-5" />
          <h1 className="text-lg font-bold">{school?.name || '学校圈子'}</h1>
        </div>
        <div className="text-xs text-white/85">
          本校道友的提问与回答 · 本校热门推荐
        </div>
        {school && (
          <div className="mt-3 flex gap-2">
            {school.is985 === true && <span className="text-[10px] bg-white/20 rounded-full px-2 py-0.5">985</span>}
            {school.is211 === true && <span className="text-[10px] bg-white/20 rounded-full px-2 py-0.5">211</span>}
          </div>
        )}
      </div>

      {/* v28：本校表白墙（常驻，空态可发布） */}
      <div className="px-4 py-3">
        <div className="bg-white rounded-2xl border border-pink-100 overflow-hidden">
          <div className="px-4 py-2.5 flex items-center gap-1.5 text-sm font-semibold text-gray-800 border-b border-gray-50">
            <Heart className="w-4 h-4 text-pink-500 fill-current" />
            本校表白墙
            <button onClick={() => navigate('/wall')} className="ml-auto flex items-center text-xs text-gray-400 hover:text-pink-600">
              全部 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {wallItems.length === 0 ? (
            <button onClick={() => navigate('/wall')} className="w-full px-4 py-4 text-center text-xs text-gray-400 hover:bg-pink-50/40">
              本校还没有表白，去勇敢说出第一句 ❤️
            </button>
          ) : (
            <div className="divide-y divide-gray-50">
              {wallItems.map((c: any) => (
                <div key={c.id} className="px-4 py-3">
                  <div className="text-sm text-gray-800 leading-relaxed line-clamp-2">
                    {c.to_name && <span className="font-semibold text-pink-600">致 {c.to_name}：</span>}
                    {c.content}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-3">
                    <span>{c.is_anonymous ? '匿名' : c.user_nickname}</span>
                    <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" /> {c.like_count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* v28：本校失物招领（常驻，空态可发布） */}
      <div className="px-4 pb-1">
        <div className="bg-white rounded-2xl border border-teal-100 overflow-hidden">
          <div className="px-4 py-2.5 flex items-center gap-1.5 text-sm font-semibold text-gray-800 border-b border-gray-50">
            <PackageSearch className="w-4 h-4 text-teal-500" />
            本校失物招领
            <button onClick={() => navigate('/lost')} className="ml-auto flex items-center text-xs text-gray-400 hover:text-teal-600">
              全部 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {lostItems.length === 0 ? (
            <button onClick={() => navigate('/lost')} className="w-full px-4 py-4 text-center text-xs text-gray-400 hover:bg-teal-50/40">
              本校暂无失物信息，去发布 🔍
            </button>
          ) : (
            <div className="divide-y divide-gray-50">
              {lostItems.map((l: any) => (
                <div key={l.id} className="px-4 py-3 flex items-center gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${l.kind === 'lost' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'}`}>
                    {l.kind === 'lost' ? '寻物' : '拾到'}
                  </span>
                  <span className="flex-1 min-w-0 text-sm text-gray-700 truncate">{l.title}</span>
                  <span className="text-[11px] text-gray-400 shrink-0 flex items-center gap-0.5"><Heart className="w-3 h-3" /> {l.like_count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* v28b：本校悬赏 */}
      <div className="px-4 pb-1">
        <div className="bg-white rounded-2xl border border-violet-100 overflow-hidden">
          <div className="px-4 py-2.5 flex items-center gap-1.5 text-sm font-semibold text-gray-800 border-b border-gray-50">
            <Trophy className="w-4 h-4 text-violet-500" />
            本校悬赏
            <button onClick={() => navigate('/bounty')} className="ml-auto flex items-center text-xs text-gray-400 hover:text-violet-600">
              全部 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {campusBounties.length === 0 ? (
            <button onClick={() => navigate('/bounty')} className="w-full px-4 py-4 text-center text-xs text-gray-400 hover:bg-violet-50/40">
              本校暂无悬赏，去发布（问答/物品/跑腿）🏆
            </button>
          ) : (
            <div className="divide-y divide-gray-50">
              {campusBounties.map((b: any) => (
                <div key={b.id} className="px-4 py-3 flex items-center gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${b.bounty_type === 'question' ? 'bg-blue-50 text-blue-600' : b.bounty_type === 'item' ? 'bg-amber-50 text-amber-600' : 'bg-purple-50 text-purple-600'}`}>
                    {b.bounty_type === 'question' ? '问答' : b.bounty_type === 'item' ? '物品' : '跑腿'}
                  </span>
                  <span className="flex-1 min-w-0 text-sm text-gray-700 truncate">{b.title}</span>
                  <span className="text-sm font-bold text-amber-600 shrink-0">¥{b.total_amount}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* v28：本校评选入口（无活动时跳全网） */}
      <div className="px-4 py-3">
        <div
          onClick={() => navigate(campusBeauty ? `/beauty?activity=${campusBeauty.id}` : '/beauty')}
          className="rounded-2xl bg-gradient-to-r from-pink-600 to-rose-500 text-white px-4 py-3 flex items-center gap-2.5 cursor-pointer active:scale-[0.99] transition-transform"
        >
          <Crown className="w-5 h-5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold">{campusBeauty ? campusBeauty.title : '校花校草评选'}</div>
            <div className="text-[11px] text-pink-100">{campusBeauty ? '本校评选 · 投票进行中' : '本校评选待开启 · 先看全网/历史校友'}</div>
          </div>
          <span className="text-xs bg-white/20 rounded-full px-3 py-1 shrink-0">去投票 →</span>
        </div>
      </div>

      {/* v28：九宫格（前 3 + 更多折叠） */}
      {services.length > 0 && (
        <div className="px-4 pb-1">
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-2.5">
              <LayoutGrid className="w-4 h-4 text-blue-500" />
              本校服务
            </div>
            <div className="grid grid-cols-3 gap-y-4">
              {services.slice(0, gridExpanded ? services.length : 3).map((sv: any) => (
                <button
                  key={sv.id}
                  onClick={() => navigate(`/service/${sv.id}`)}
                  className="flex flex-col items-center gap-1.5 py-1 active:scale-95 transition-transform"
                >
                  <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
                    <ServiceIcon name={sv.icon} className="w-5 h-5 text-blue-600" />
                  </div>
                  <span className="text-xs text-gray-600">{sv.label}</span>
                </button>
              ))}
            </div>
            {services.length > 3 && (
              <button
                onClick={() => setGridExpanded((v) => !v)}
                className="w-full h-8 mt-2.5 rounded-lg bg-gray-50 text-gray-500 text-xs font-medium flex items-center justify-center gap-1"
              >
                {gridExpanded ? '收起' : `更多服务（${services.length - 3}）`}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${gridExpanded ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* v23：私域广告展板（平台官方位优先） */}
      {boards.length > 0 && (
        <div className="px-4 pb-1">
          <AdBoard boards={boards} campusName={school?.name} />
        </div>
      )}

      {/* v23：校园商家 */}
      <div className="px-4 py-3">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
              <Store className="w-4 h-4 text-emerald-500" />
              校园商家
            </div>
            <div className="flex gap-1.5">
              {myMerchant?.status === 'approved' && (
                <button
                  onClick={() => setBuyOpen(true)}
                  className="h-8 px-3.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold hover:brightness-105"
                >
                  购买展板位
                </button>
              )}
              {!myMerchant && (
                <button
                  onClick={() => setMerchantOpen(true)}
                  className="h-8 px-3.5 rounded-full bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600"
                >
                  商家入驻
                </button>
              )}
              {myMerchant && myMerchant.status !== 'approved' && (
                <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 bg-amber-50 rounded-full px-2.5 py-1">
                  入驻{myMerchant.status === 'pending' ? '审核中' : '被拒'}
                </span>
              )}
            </div>
          </div>
          {merchants.length > 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {merchants.map((m: any) => (
                <div key={m.id} className="rounded-xl bg-gray-50 p-3">
                  <div className="text-sm font-medium text-gray-800 truncate">{m.shop_name}</div>
                  <div className="text-[11px] text-gray-400 truncate mt-0.5">{m.category} · {m.address || '校内'}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
              本校区暂无入驻商家。商家入驻后可购买<b>私域广告展板位</b>，向本校区学生展示（平台收展位费）。
            </p>
          )}
        </div>
      </div>

      {/* 商家入驻弹窗 */}
      <Dialog open={merchantOpen} onOpenChange={setMerchantOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <Store className="w-4 h-4 text-emerald-500" />
              商家入驻
            </DialogTitle>
            <DialogDescription>入驻后可在本校区购买广告展板位，向学生展示店铺</DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5">
            <input value={merchantForm.shop_name} onChange={(e) => setMerchantForm({ ...merchantForm, shop_name: e.target.value })} placeholder="店铺名称 *" className="w-full h-10 rounded-xl bg-gray-50 px-3 text-sm outline-none" />
            <select value={merchantForm.category} onChange={(e) => setMerchantForm({ ...merchantForm, category: e.target.value })} className="w-full h-10 rounded-xl bg-gray-50 px-3 text-sm outline-none">
              {['餐饮', '自习室', '打印', '租房', '驾校', '考研', '其他'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input value={merchantForm.address} onChange={(e) => setMerchantForm({ ...merchantForm, address: e.target.value })} placeholder="店铺地址（可选）" className="w-full h-10 rounded-xl bg-gray-50 px-3 text-sm outline-none" />
            <textarea value={merchantForm.description} onChange={(e) => setMerchantForm({ ...merchantForm, description: e.target.value })} rows={2} placeholder="店铺介绍（可选）" className="w-full rounded-xl bg-gray-50 px-3 py-2.5 text-sm outline-none resize-none" />
          </div>
          <DialogFooter>
            <button onClick={() => setMerchantOpen(false)} className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">取消</button>
            <button onClick={submitMerchant} disabled={merchantBusy} className="h-9 px-6 bg-emerald-500 text-white text-sm font-medium rounded-full disabled:opacity-40">
              {merchantBusy ? '提交中...' : '提交入驻'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 购买展板位弹窗 */}
      <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <Megaphone className="w-4 h-4 text-orange-500" />
              购买私域广告展板位
            </DialogTitle>
            <DialogDescription>按校区/时长计价，平台收展位费（余额支付）</DialogDescription>
          </DialogHeader>
          {boardPrice && (
            <div className="grid grid-cols-3 gap-2 text-center">
              {[['weekly', '周', boardPrice.weekly], ['monthly', '月', boardPrice.monthly], ['quarterly', '季', boardPrice.quarterly]].map(([k, label, price]: any[]) => (
                <button
                  key={k}
                  onClick={() => setBuyForm({ ...buyForm, duration: k })}
                  className={`rounded-xl border py-2.5 ${buyForm.duration === k ? 'border-orange-400 bg-orange-50' : 'border-gray-200'}`}
                >
                  <div className="text-xs text-gray-500">{label}</div>
                  <div className="text-base font-bold text-orange-600">¥{price}</div>
                </button>
              ))}
            </div>
          )}
          <div className="space-y-2.5">
            <input value={buyForm.title} onChange={(e) => setBuyForm({ ...buyForm, title: e.target.value })} placeholder="展位标题 *（如：XX自习室开学季 8 折）" className="w-full h-10 rounded-xl bg-gray-50 px-3 text-sm outline-none" />
            <input value={buyForm.body} onChange={(e) => setBuyForm({ ...buyForm, body: e.target.value })} placeholder="副文案（可选）" className="w-full h-10 rounded-xl bg-gray-50 px-3 text-sm outline-none" />
            <input value={buyForm.link} onChange={(e) => setBuyForm({ ...buyForm, link: e.target.value })} placeholder="跳转链接（可选，/站内 或 https://）" className="w-full h-10 rounded-xl bg-gray-50 px-3 text-sm outline-none" />
          </div>
          <DialogFooter>
            <button onClick={() => setBuyOpen(false)} className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">取消</button>
            <button onClick={submitBuyBoard} disabled={buyBusy} className="h-9 px-6 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-bold rounded-full disabled:opacity-40">
              {buyBusy ? '处理中...' : '确认购买（余额支付）'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="px-4 py-3">
        <div className="bg-white rounded-xl border border-emerald-100 p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              学校认证
            </div>
            {myVerify?.verified ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 rounded-full px-2.5 py-1">
                <BadgeCheck className="w-3.5 h-3.5" /> 已认证 · 可在付费咨询接单
              </span>
            ) : myVerify?.application?.status === 'pending' ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-50 rounded-full px-2.5 py-1">
                <Loader2 className="w-3 h-3 animate-spin" /> 认证审核中
              </span>
            ) : myVerify?.application?.status === 'rejected' ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-500 bg-red-50 rounded-full px-2.5 py-1">
                认证被拒{myVerify.application.reject_reason ? `：${myVerify.application.reject_reason}` : ''}
              </span>
            ) : (
              <button
                onClick={applyVerify}
                disabled={applying}
                className="h-8 px-4 rounded-full bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600 disabled:opacity-50"
              >
                {applying ? '提交中...' : '申请学校认证'}
              </button>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
            认证修士 = 经过后台审核的本校修士。认证后可获得专属标识，并在「付费咨询学长学姐」中接单答疑（管理员审核，后台「认证审核」菜单）。
          </p>

          {/* 认证修士榜 */}
          {verifiedMembers.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-2">
                <Users className="w-3.5 h-3.5 text-emerald-500" />
                本校认证修士（{verifiedMembers.length}）
              </div>
              <div className="flex flex-wrap gap-2">
                {verifiedMembers.map((m: any) => (
                  <button
                    key={m.id}
                    onClick={() => navigate(`/user/${m.id}`)}
                    className="flex items-center gap-1.5 bg-gray-50 hover:bg-emerald-50 rounded-full pl-1 pr-2.5 py-1 transition-colors"
                  >
                    <Avatar src={m.avatar} alt={m.nickname} className="w-5 h-5" />
                    <span className="text-xs text-gray-700">{m.nickname}</span>
                    <BadgeCheck className="w-3 h-3 text-emerald-500" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 本校热门问题 */}
      <div className="px-4 py-3 flex items-center gap-1.5 text-sm font-semibold text-gray-800">
        <Trophy className="w-4 h-4 text-amber-500" />
        本校热门
      </div>

      <div className="bg-white divide-y divide-gray-100 border-t border-b border-gray-100">
        {feed.length === 0 && !loading && (
          <div className="text-center py-16 text-gray-400 text-sm">
            本校还没有问题，去提第一个吧～
          </div>
        )}
        {feed.map((q: any) => (
          <button
            key={q.id}
            onClick={() => navigate(`/question/${q.id}`)}
            className="w-full px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="text-sm font-medium text-gray-800 line-clamp-2 mb-1">
              {q.is_anonymous ? '【匿名】' : ''}{q.title}
            </div>
            <div className="text-xs text-gray-500 line-clamp-1 mb-1.5">{q.content}</div>
            <div className="flex items-center gap-3 text-[11px] text-gray-400">
              <span className="text-amber-500 font-medium">热度 {q.hot_score || 0}</span>
              <span>{q.answer_count || 0} 回答</span>
              <span>{q.is_anonymous ? '匿名道友' : q.author}</span>
            </div>
          </button>
        ))}
      </div>

      {hasMore && feed.length > 0 && (
        <div className="px-4 py-3">
          <button
            onClick={() => loadMore()}
            disabled={loading}
            className="w-full h-10 rounded-full bg-white border border-gray-200 text-sm text-gray-600 hover:border-blue-300 hover:text-blue-600 disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? '加载中...' : '加载更多'}
          </button>
        </div>
      )}

      {/* 返回专题入口 */}
      <div className="px-4">
        <button
          onClick={() => navigate('/topic/university')}
          className="w-full h-10 rounded-full bg-gray-100 text-sm text-gray-500 hover:bg-gray-200 flex items-center justify-center gap-1"
        >
          返回大学专题 <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
