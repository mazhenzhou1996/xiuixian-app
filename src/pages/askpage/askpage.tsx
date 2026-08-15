import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Image, X, School, EyeOff, ChevronDown, Coins, PackageSearch, HelpCircle, Bike, Tag, Phone, Gift } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import { useXiuxianStore } from '@/store/useStore';
import { api } from '@/lib/api';
import { usePageTitle } from '@/hooks/usePageTitle';
import { createItemBounty, PLATFORM_FEE_RATE } from '@/lib/features';
import { listCampuses } from '@/lib/commerce';
import SchoolPickerDialog from '@/components/schoolpickerdialog';

// 类型：寻物 / 提问 / 代办跑腿 / 其他（其他映射到 bounty 的 service 类型）
const TYPES = [
  { key: 'item', label: '寻物', Icon: PackageSearch },
  { key: 'question', label: '提问', Icon: HelpCircle },
  { key: 'todo', label: '代办跑腿', Icon: Bike },
  { key: 'service', label: '其他', Icon: Tag },
] as const;

export default function AskPage() {
  usePageTitle('提问');
  const navigate = useNavigate();
  const store = useXiuxianStore();
  const currentUser = store.getCurrentUser();

  // 基础字段
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 类型（统一类型，用于悬赏榜分类）
  const [qtype, setQtype] = useState<'item' | 'question' | 'todo' | 'service'>('question');

  // 悬赏金额：默认 0 元；发布需至少 ¥1（签到每日领 1 元，或到付费功能充值）
  const [amount, setAmount] = useState('0');

  // 学校选择（必选）
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [schoolName, setSchoolName] = useState('');
  const [schoolPickerOpen, setSchoolPickerOpen] = useState(false);

  // 仅本校可见（默认不选）
  const [campusOnly, setCampusOnly] = useState(false);

  // 联系方式（选填）
  const [contact, setContact] = useState('');

  // 钱包余额 + 签到（用于发布前校验与提醒）
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [fundOpen, setFundOpen] = useState(false);
  const [checkedToday, setCheckedToday] = useState(false);
  const [checking, setChecking] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 余额 + 今日签到状态
  useEffect(() => {
    if (!currentUser) { setWalletBalance(null); setCheckedToday(false); return; }
    api.getMyWallet().then((w: any) => setWalletBalance(w?.balance ?? 0)).catch(() => setWalletBalance(0));
    api.getMyCheckin().then((c: any) => setCheckedToday(!!c?.checked_today)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const handleCheckin = async () => {
    if (!currentUser || checking || checkedToday) return;
    setChecking(true);
    try {
      const r = await api.checkin();
      setCheckedToday(true);
      toast.success(`签到成功！获得 ¥${r?.reward ?? 1}（连签 ${r?.streak ?? 1} 天）`);
      const w = await api.getMyWallet();
      setWalletBalance(w?.balance ?? 0);
    } catch (e: any) {
      toast.error(e?.message || '签到失败，请稍后再试');
    } finally {
      setChecking(false);
    }
  };

  // 实时计算金额与资金拦截状态
  // 注：学校为必选项，发布前会校验 schoolId
  const feeRate = PLATFORM_FEE_RATE;
  const amt = Number(amount) || 0;
  const serviceFee = Math.round(amt * feeRate * 100) / 100;
  const bountyPool = Math.round((amt - serviceFee) * 100) / 100;
  const fundBlocked = currentUser != null && (amt < 1 || (walletBalance !== null && walletBalance < amt));

  // 真实上传：图片直接进 Supabase Storage，正文存公网 URL（不再用 base64）
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    e.target.value = '';
    if (!currentUser) {
      toast.info('请先登录');
      navigate('/login');
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (images.length >= 9) {
          toast.info('最多上传 9 张图片');
          break;
        }
        const url = await api.uploadImage(file);
        setImages((prev) => [...prev, url]);
      }
    } catch (err: any) {
      toast.error(err?.message || '图片上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  // 仅本校可见时：把所选学校的校区 id 解析出来（用于本校悬赏榜匹配）
  const resolveCampusId = async (): Promise<number | null> => {
    if (!campusOnly) return null;
    const sid = schoolId ?? store.getSelectedSchool()?.id;
    if (!sid) return null;
    try {
      const campuses = await listCampuses().catch(() => []);
      const campus = (campuses || []).find((x: any) => Number(x.university_id) === Number(sid));
      return campus ? campus.id : null;
    } catch {
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!currentUser) {
      toast.info('请先登录');
      navigate('/login');
      return;
    }
    if (!title.trim() || title.trim().length < 5) {
      toast.error('请输入问题标题（至少5个字）');
      return;
    }
    if (!content.trim()) {
      toast.error('请输入问题详情');
      return;
    }
    if (!schoolId) {
      toast.error('请先选择所在学校（必选）');
      return;
    }
    if (amt < 1) {
      setFundOpen(true);
      toast.error('发布需至少 ¥1 悬赏金，签到每日可领 1 元');
      return;
    }
    if (amt > 200) {
      toast.error('悬赏金额需在 1-200 元之间');
      return;
    }

    setSubmitting(true);
    try {
      // 发布前再次校验余额（服务端也会校验）
      const w = await api.getMyWallet();
      const bal = w?.balance ?? 0;
      setWalletBalance(bal);
      if (bal < amt) {
        setFundOpen(true);
        toast.error(`余额不足，还差 ¥${amt - bal}，请先签到或充值`);
        return;
      }
      // 填金额 = 悬赏：进入悬赏榜（整体 + 勾选本校时进本校悬赏榜）
      const campusId = await resolveCampusId();
      const res = await createItemBounty({
        title: title.trim(),
        content: content.trim(),
        amount: amt,
        type: qtype,
        campusId,
        contact: contact.trim(),
      });
      toast.success('悬赏发布成功，已进入悬赏榜！');
      navigate(`/bounty/${res?.bounty_id || ''}`, { replace: true });
    } catch (err: any) {
      toast.error(err?.message || '发布失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <PageHeader title="提问" />

      <div className="flex-1 px-4 py-3 space-y-3">
        {/* 类型 */}
        <div className="bg-white rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-3">
            <Tag className="w-4 h-4 text-blue-500" />
            类型
          </div>
          <div className="grid grid-cols-4 gap-2">
            {TYPES.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setQtype(key)}
                className={`flex flex-col items-center gap-1 rounded-xl border py-3 transition-colors ${qtype === key ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500'}`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 悬赏金额：默认 0，发布需至少 ¥1 */}
        <div className="bg-white rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
            <Coins className="w-4 h-4 text-amber-500" />
            悬赏金额
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount((e.target.value || '').replace(/[^0-9]/g, ''))}
              min={0}
              max={200}
              placeholder="默认 0 元，发布需至少 ¥1"
              className="w-28 h-10 rounded-xl bg-gray-50 px-3 text-sm outline-none"
            />
            <span className="text-sm text-gray-400">元</span>
            <span className="text-[11px] text-gray-400 ml-auto">填金额即悬赏（1-200 元），自动进入悬赏榜</span>
          </div>
          <div className="text-[11px] text-gray-400 mt-2">
            零元不可发布：每日右上角签到可领 1 元，或到「我的 → 付费功能」充值后再发布。
            {amt >= 1 && (
              <div className="mt-1.5 text-amber-600">
                悬赏 ¥{amt} 含平台服务费 <b>¥{serviceFee}</b>（{Math.round(feeRate * 100)}%），实际赏金池 <b>¥{bountyPool}</b>（最佳答案 70% / 其余 30% 分红）。
              </div>
            )}
          </div>
        </div>

        {/* 学校选择（必选） */}
        <div className="bg-white rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
            <School className="w-4 h-4 text-emerald-500" />
            学校选择 <span className="text-red-500">*</span>
          </div>
          <button
            onClick={() => setSchoolPickerOpen(true)}
            className={`flex items-center gap-1.5 text-sm px-3 py-2.5 rounded-xl border transition-colors w-full ${schoolId ? 'border-emerald-500 text-emerald-600 bg-emerald-50' : 'border-red-300 text-red-500 bg-red-50'}`}
          >
            <School className="w-4 h-4" />
            <span className="max-w-[220px] truncate flex-1 text-left">{schoolName || '请选择所在学校（必选）'}</span>
            <ChevronDown className="w-4 h-4 shrink-0" />
          </button>
        </div>
        <SchoolPickerDialog
          open={schoolPickerOpen}
          onClose={() => setSchoolPickerOpen(false)}
          onSelect={(s: any) => { setSchoolId(s.id); setSchoolName(s.name); }}
          selectedId={schoolId}
          title="选择所在学校"
          description="发布悬赏需选择学校，用于本校圈子与本校悬赏榜"
        />

        {/* 仅本校可见（默认不选） */}
        <div className="flex items-center justify-between rounded-xl bg-white border border-gray-100 px-4 py-3">
          <div>
            <div className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <EyeOff className="w-4 h-4 text-gray-400" />
              仅本校可见
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              {campusOnly ? '关联本校，将同时进入本校悬赏榜' : '所有人可见（悬赏默认进入整体悬赏榜）'}
            </div>
          </div>
          <button
            onClick={() => setCampusOnly((v) => !v)}
            className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${campusOnly ? 'bg-red-500' : 'bg-gray-200'}`}
            aria-pressed={campusOnly}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${campusOnly ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>

        {/* 联系方式 */}
        <div className="bg-white rounded-xl p-4 flex items-center gap-2">
          <Phone className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="联系方式（选填，微信/电话，用于线下交付）"
            maxLength={30}
            className="flex-1 h-10 bg-transparent outline-none text-sm placeholder-gray-400"
          />
        </div>

        {/* 标题 */}
        <div className="bg-white rounded-xl p-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="请输入问题标题（至少5个字）"
            maxLength={50}
            className="w-full text-base font-medium text-gray-800 placeholder-gray-400 outline-none border-0 bg-transparent"
          />
          <div className="text-right text-xs text-gray-400 mt-1">
            {title.length}/50
          </div>
        </div>

        {/* 详情 */}
        <div className="bg-white rounded-xl p-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="详细描述你的问题，有助于道友们给出更准确的回答..."
            rows={8}
            className="w-full text-sm text-gray-700 placeholder-gray-400 outline-none border-0 bg-transparent resize-none leading-relaxed"
          />
          <div className="text-right text-xs text-gray-400 mt-1">
            {content.length} 字
          </div>
        </div>

        {/* 图片上传 */}
        <div className="bg-white rounded-xl p-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            className="hidden"
          />
          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {images.map((img, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 disabled:opacity-50"
          >
            <Image className="w-4 h-4" />
            <span>{uploading ? '上传中...' : '图片'}</span>
          </button>
        </div>

        {/* 悬赏说明 */}
        {(Number(amount) || 0) > 0 && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 text-xs text-amber-700 leading-relaxed">
            当前为<span className="font-semibold">悬赏发布</span>：发布后进入<b className="text-amber-800">悬赏榜</b>，道友可接取并提交答复，你认可最佳后结算赏金（线下交付）。
            悬赏 ¥{amt} 中含 <b>{Math.round(feeRate * 100)}%</b> 平台服务费 <b>¥{serviceFee}</b>，剩余 <b>¥{bountyPool}</b> 进入赏金池。
            {campusOnly && schoolId ? '已勾选仅本校可见，将同时进入本校悬赏榜。' : ''}
          </div>
        )}

        {/* 资金提醒（零元 / 余额不足时醒目提示） */}
        {(fundBlocked || fundOpen) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="text-sm font-semibold text-amber-800 mb-1">发布需余额支持</div>
            <div className="text-xs text-amber-700 leading-relaxed mb-3">
              {amt < 1
                ? '悬赏金额至少 ¥1。每日右上角签到可领 1 元，或到「付费功能」充值后再发布。'
                : `当前余额 ¥${walletBalance ?? 0}，发布本悬赏需 ¥${amt}，还差 ¥${Math.max(0, amt - (walletBalance ?? 0))}。`}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCheckin}
                disabled={checking || checkedToday}
                className="flex-1 h-10 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50"
              >
                <Gift className="w-4 h-4" />
                {checkedToday ? '今日已签' : '去签到领1元'}
              </button>
              <button
                onClick={() => navigate('/consult-center')}
                className="flex-1 h-10 rounded-xl bg-amber-500 text-white text-sm font-medium flex items-center justify-center gap-1"
              >
                <Coins className="w-4 h-4" />
                去充值
              </button>
            </div>
          </div>
        )}

        {!currentUser && (
          <div className="text-center py-10">
            <p className="text-sm text-gray-400 mb-3">登录后才能提问哦</p>
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-2 bg-blue-600 text-white text-sm rounded-full"
            >
              去登录
            </button>
          </div>
        )}
      </div>

      {/* 底部醒目发布行 */}
      <div className="sticky bottom-0 z-30 bg-white border-t border-gray-100 px-4 py-3 shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full h-12 rounded-xl bg-red-600 text-white text-base font-bold disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {submitting ? '发布中...' : (amt >= 1 ? `发布悬赏 · ¥${amt}` : '发布（需设置悬赏金额 ¥1 起）')}
        </button>
      </div>
    </div>
  );
}
