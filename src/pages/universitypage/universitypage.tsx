import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  GraduationCap,
  School,
  MapPin,
  Award,
  Star,
  Coins,
  BedDouble,
  AlertTriangle,
  FileText,
  NotebookPen,
  BookOpenCheck,
  Compass,
  LifeBuoy,
  Ticket,
  ChevronRight,
  BadgeCheck,
  Trophy,
} from 'lucide-react';
import Avatar from '@/components/Avatar';
import PageHeader from '@/components/PageHeader';
import QuestionCard from '@/components/QuestionCard';
import { useXiuxianStore } from '@/store/useStore';
import { publicTopic } from '@/lib/adminapi';
import { api } from '@/lib/api';
import { ServiceIcon } from '@/lib/iconmap';
import AdUnlockDialog from '@/components/adunlockdialog';
import SchoolPickerDialog from '@/components/schoolpickerdialog';
import ConsultationDialog from '@/components/consultationdialog';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';



const CONFIGS: Record<string, { title: string; services: { label: string; icon: any }[]; hotLabel: string; payText: string }> = {
  university: {
    title: '大学专题',
    hotLabel: '大学热门',
    payText: '付费咨询学长学姐',
    services: [
      { label: '学费查询', icon: Coins },
      { label: '住宿查询', icon: BedDouble },
      { label: '奇葩规定', icon: AlertTriangle },
      { label: '考试真题', icon: FileText },
      { label: '学霸笔记', icon: NotebookPen },
      { label: '挂科辅导', icon: BookOpenCheck },
      { label: '选课指南', icon: Compass },
      { label: '生活指南', icon: LifeBuoy },
      { label: '优惠卡券', icon: Ticket },
    ],
  },
  graduate: {
    title: '研究生专题',
    hotLabel: '研究生热门',
    payText: '咨询上岸学长学姐',
    services: [
      { label: '考研择校', icon: Compass },
      { label: '初试复试辅导', icon: BookOpenCheck },
      { label: '专业课真题', icon: FileText },
      { label: '导师选择', icon: NotebookPen },
      { label: '奖励补助', icon: Coins },
      { label: '进面录取', icon: Ticket },
      { label: '住宿查询', icon: BedDouble },
      { label: '奇葩规定', icon: AlertTriangle },
      { label: '生活指南', icon: LifeBuoy },
    ],
  },
};

export default function UniversityPage() {
  const { id = 'university' } = useParams<{ id: string }>();
  const localCfg = CONFIGS[id] || CONFIGS.university;
  const navigate = useNavigate();
  const store = useXiuxianStore();
  const [school, setSchool] = useState<any>(() => store.getSelectedSchool());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [hotTab, setHotTab] = useState<'all' | 'school'>('all');

  // 广告解锁弹窗（网盘链接服务）
  const [unlockService, setUnlockService] = useState<any | null>(null);

  // v18：付费咨询固定格 → 本校认证修士咨询弹窗
  const [payMembers, setPayMembers] = useState<any[]>([]);
  const [consultExpert, setConsultExpert] = useState<any | null>(null);

  // 数据库配置（高校列表 / 九宫格服务 / 专题配置），DB 为空时回退本地常量
  const [universities, setUniversities] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [config, setConfig] = useState<any | null>(null);
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [unis, svcs, cfg] = await Promise.all([
          publicTopic.getUniversities(),
          publicTopic.getServices(id),
          publicTopic.getTopicConfig(id),
        ]);
        if (unis.length > 0) setUniversities(unis);
        if (svcs.length > 0) setServices(svcs);
        if (cfg) setConfig(cfg);
      } catch { /* 数据库不可用时回退本地配置 */ }
      setDbReady(true);
    })();
  }, [id]);

  const cfg = {
    title: config?.title || localCfg.title,
    hotLabel: config?.hot_label || localCfg.hotLabel,
    payText: config?.pay_text || localCfg.payText,
    services: services.length > 0 ? services : localCfg.services,
  };
  usePageTitle(cfg.title);

  const hotQuestions = useMemo(() => {
    const qs = store.getQuestions();
    const sorted = [...qs].sort((a, b) => b.hotScore - a.hotScore).slice(0, 10);
    if (hotTab === 'school' && school) {
      // 本校热门：优先匹配包含学校名的问题，无则显示全部热门
      const matched = qs.filter((q: any) => `${q.title} ${q.content}`.includes(school.name));
      return matched.length > 0 ? matched.slice(0, 10) : sorted;
    }
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, hotTab, school]);

  return (
    <div className="min-h-screen bg-gray-50 pb-4">
      <PageHeader title={cfg.title} />

      {/* 选择学校（强制） */}
      <div className="px-4 pt-3">
        {!school ? (
          <button
            onClick={() => setPickerOpen(true)}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold flex items-center justify-center gap-2 hover:from-amber-600 hover:to-orange-600 transition-colors shadow-md shadow-orange-100"
          >
            <School className="w-4.5 h-4.5" />
            选择学校（必选）
          </button>
        ) : (
          <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl p-4 text-white relative overflow-hidden">
            <div className="absolute -right-5 -top-6 w-20 h-20 rounded-full bg-white/10" />
            <div className="relative z-10 flex gap-4">
              {/* 左侧：学校信息 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <GraduationCap className="w-5 h-5 shrink-0" />
                  <span className="text-base font-bold break-words">{school.name}</span>
                  <button
                    onClick={() => setPickerOpen(true)}
                    className="shrink-0 text-sm font-semibold bg-red-500 rounded-full px-4 py-1.5 hover:bg-red-600 shadow-md shadow-red-200 active:scale-95 transition-all"
                  >
                    切换学校
                  </button>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                  {(school.tags || []).map((t: string) => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-white/20 flex items-center gap-0.5">
                      <BadgeCheck className="w-3 h-3" />
                      {t}
                    </span>
                  ))}
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20 flex items-center gap-0.5">
                    <Award className="w-3 h-3" />
                    {school.qs}
                  </span>
                </div>
                <div className="text-[11px] text-blue-100 flex items-center gap-1 mb-3">
                  <MapPin className="w-3.5 h-3.5" />
                  {school.address}
                </div>
                {/* 付费咨询 + 本校道友榜：一行各占一半 */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPayOpen(true)}
                    className="flex-1 h-9 rounded-lg bg-gradient-to-r from-amber-400 to-orange-400 text-white text-xs font-bold flex items-center justify-center gap-1 hover:from-amber-500 hover:to-orange-500 transition-colors min-w-0"
                  >
                    <Star className="w-3.5 h-3.5 fill-current shrink-0" />
                    <span className="truncate">{cfg.payText}</span>
                  </button>
                  <button
                    onClick={() => navigate('/rank')}
                    className="flex-1 h-9 rounded-lg bg-white/20 text-white text-xs font-bold flex items-center justify-center gap-1 hover:bg-white/30 transition-colors min-w-0"
                  >
                    <Trophy className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">本校道友榜</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* 9 宫格服务（数据库配置，可增删改/排序/启停/自定义链接） */}
      <div className="px-4 mt-3">
        <div className="bg-white rounded-xl p-4">
          {!dbReady ? (
            <div className="py-6 text-center text-xs text-gray-400">加载中...</div>
          ) : (
            <div className="grid grid-cols-3 gap-y-4">
              {[...(cfg.services || services)]
                // v18：付费咨询固定格永远第一
                .sort((a: any, b: any) => {
                  const fa = a.fixed || (a.label || '').includes('付费咨询') ? 0 : 1;
                  const fb = b.fixed || (b.label || '').includes('付费咨询') ? 0 : 1;
                  return fa - fb;
                })
                .map((sv: any) => {
                  const isPay = sv.fixed || (sv.label || '').includes('付费咨询');
                  return (
                    <button
                      key={sv.id || sv.label}
                      onClick={() => {
                        if (isPay) {
                          // 付费咨询：打开本校认证修士列表
                          const sid = school?.id || (universities[0] as any)?.id;
                          if (!sid) { toast.info('请先选择学校'); return; }
                          setPayOpen(true);
                          setPayMembers([]);
                          api.listVerifiedMembers(sid, 20).then(setPayMembers).catch(() => {});
                        } else {
                          // 点击进入该高校该服务的内容页(文字 + 网盘附件广告解锁)
                          navigate(`/service/${sv.id}`);
                        }
                      }}
                      className="flex flex-col items-center gap-1.5 py-1 active:scale-95 transition-transform"
                    >
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${isPay ? 'bg-gradient-to-br from-amber-400 to-orange-400 shadow-md shadow-orange-200' : 'bg-blue-50'}`}>
                        {typeof sv.icon === 'string' ? (
                          <ServiceIcon name={sv.icon} className={`w-5 h-5 ${isPay ? 'text-white' : 'text-blue-600'}`} />
                        ) : (
                          <sv.icon className={`w-5 h-5 ${isPay ? 'text-white' : 'text-blue-600'}`} />
                        )}
                      </div>
                      <span className={`text-xs ${isPay ? 'font-semibold text-amber-600' : 'text-gray-600'}`}>{sv.label}</span>
                      {isPay && (
                        <span className="-mt-1 flex items-center gap-0.5 text-[9px] text-emerald-600">
                          <BadgeCheck className="w-3 h-3" /> 认证修士
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          )}
          {/* 更多服务 */}
          <button
            onClick={() => toast.info('更多服务建设中，敬请期待')}
            className="w-full h-9 mt-4 rounded-lg bg-gray-50 text-gray-500 text-xs font-medium flex items-center justify-center gap-1 hover:bg-gray-100 transition-colors"
          >
            更多服务
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 热门切换 */}
      <div className="px-4 mt-3">
        <div className="bg-white rounded-lg p-1 flex">
          {([
            { key: 'all', label: cfg.hotLabel },
            { key: 'school', label: '本校热门' },
          ] as { key: 'all' | 'school'; label: string }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setHotTab(t.key)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                hotTab === t.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 问答列表 */}
      <div className="pt-2">
        {hotQuestions.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">暂无内容</div>
        ) : (
          <div className="bg-white divide-y divide-gray-100 border-t border-b border-gray-100">
            {hotQuestions.map((q) => (
              <QuestionCard key={q.id} question={q} />
            ))}
          </div>
        )}
      </div>

      {/* 广告解锁弹窗 */}
      {unlockService && (
        <AdUnlockDialog service={unlockService} onClose={() => setUnlockService(null)} />
      )}

      {/* v18：付费咨询 → 本校认证修士咨询弹窗 */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <BadgeCheck className="w-4 h-4 text-emerald-500" />
              本校认证修士 · 付费咨询
            </DialogTitle>
            <DialogDescription>以下修士已通过学校认证审核，可放心咨询</DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto space-y-2">
            {payMembers.length === 0 ? (
              <div className="text-center py-10 text-xs text-gray-400">
                该校暂无认证修士
                <div className="mt-1.5 text-[11px]">认证修士可在此接单解答，学校认证入口见学校圈子页</div>
              </div>
            ) : (
              payMembers.map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-emerald-200 transition-colors">
                  <Avatar src={m.avatar} alt={m.nickname} className="w-10 h-10" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-gray-800 truncate">{m.nickname}</span>
                      <BadgeCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    </div>
                    <div className="text-xs text-gray-400 truncate">{m.bio || `认证修士 · ${m.points} 声望`}</div>
                  </div>
                  <button
                    onClick={() => setConsultExpert(m)}
                    className="shrink-0 h-8 px-4 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold shadow-sm shadow-orange-200 hover:brightness-105"
                  >
                    咨询TA
                  </button>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <button onClick={() => setPayOpen(false)} className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">关闭</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {consultExpert && (
        <ConsultationDialog
          expertId={consultExpert.id}
          expertName={consultExpert.nickname}
          onClose={() => setConsultExpert(null)}
        />
      )}

      {/* 选择学校弹窗（v30：省份筛选 + 搜索） */}
      <SchoolPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selectedId={school?.id}
        title="选择学校"
        description="按省份筛选或直接搜索学校名称"
        onSelect={(s) => {
          setSchool(s);
          store.setSelectedSchool(s);
        }}
      />

      {/* 付费咨询弹窗 */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>付费咨询</DialogTitle>
            <DialogDescription>
              向{school?.name || ''}的学长学姐发起一对一付费咨询
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-700">
            付费咨询功能即将上线，敬请期待～
          </div>
          <DialogFooter>
            <button
              onClick={() => setPayOpen(false)}
              className="h-9 px-6 bg-blue-600 text-white text-sm font-medium rounded-full hover:bg-blue-700"
            >
              我知道了
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
