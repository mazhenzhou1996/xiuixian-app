import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flag, School, FileText, MessageSquare, LayoutGrid, Users, Megaphone, ArrowRight, Loader2, TrendingUp, PieChart as PieIcon, BarChart3 } from 'lucide-react';
import { adminApi } from '@/lib/adminapi';
import { formatTime } from '@/utils/format';
import { toast } from 'sonner';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [dash, setDash] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, r, d] = await Promise.all([
          adminApi.getStats(),
          adminApi.listReports('pending'),
          adminApi.getDashboardStats(),
        ]);
        setStats(s);
        setReports(r.slice(0, 8));
        setDash(d);
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 内容状态分布（饼图）
  const statusData = dash?.status
    ? [
        { name: '已发布', value: Number(dash.status.active || 0), color: '#22c55e' },
        { name: '待审', value: Number(dash.status.pending || 0), color: '#f59e0b' },
        { name: '已标记', value: Number(dash.status.flagged || 0), color: '#ef4444' },
        { name: '已删除', value: Number(dash.status.deleted || 0), color: '#9ca3af' },
      ]
    : [];
  const hasStatus = statusData.some((s) => s.value > 0);
  const daily = Array.isArray(dash?.daily) ? dash.daily : [];
  const topSchools = Array.isArray(dash?.topSchools) ? dash.topSchools : [];

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> 加载中...
      </div>
    );
  }

  const cards = [
    { label: '待处理举报', value: stats?.pendingReports ?? 0, icon: Flag, color: 'bg-red-50 text-red-500', to: 'reports' },
    { label: '举报总数', value: stats?.reports ?? 0, icon: Flag, color: 'bg-orange-50 text-orange-500', to: 'reports' },
    { label: '注册用户', value: '—', icon: Users, color: 'bg-blue-50 text-blue-500', to: 'users' },
    { label: '问题数', value: stats?.questions ?? 0, icon: FileText, color: 'bg-blue-50 text-blue-500', to: 'content' },
    { label: '回答数', value: stats?.answers ?? 0, icon: MessageSquare, color: 'bg-green-50 text-green-500', to: 'content' },
    { label: '高校数量', value: stats?.universities ?? 0, icon: School, color: 'bg-violet-50 text-violet-500', to: 'universities' },
    { label: '九宫格服务', value: stats?.services ?? 0, icon: LayoutGrid, color: 'bg-indigo-50 text-indigo-500', to: 'services' },
    { label: '运营公告', value: '—', icon: Megaphone, color: 'bg-teal-50 text-teal-500', to: 'announcements' },
  ];

  return (
    <div className="space-y-5">
      {/* 指标卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((c) => (
          <button
            key={c.label}
            onClick={() => navigate(`/admin?tab=${c.to}`)}
            className="bg-white rounded-2xl p-4 text-left hover:shadow-md transition-shadow"
          >
            <div className={`w-9 h-9 rounded-xl ${c.color} flex items-center justify-center mb-2.5`}>
              <c.icon className="w-4.5 h-4.5" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{c.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{c.label}</div>
          </button>
        ))}
      </div>

      {/* 数据看板（recharts 可视化） */}
      <div className="space-y-4">
        {/* 近 14 天趋势 */}
        <div className="bg-white rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-gray-800">近 14 天内容趋势</span>
          </div>
          {daily.length === 0 ? (
            <div className="text-xs text-gray-400 py-8 text-center">暂无趋势数据（执行 v14 看板迁移后展示）</div>
          ) : (
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <LineChart data={daily} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="questions" name="问题" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="answers" name="回答" stroke="#22c55e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          {/* 内容状态分布 */}
          <div className="bg-white rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <PieIcon className="w-4 h-4 text-violet-600" />
              <span className="text-sm font-semibold text-gray-800">内容状态分布</span>
            </div>
            {!hasStatus ? (
              <div className="text-xs text-gray-400 py-8 text-center">暂无状态数据</div>
            ) : (
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                      {statusData.map((s: any, i: number) => <Cell key={i} fill={s.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="flex flex-wrap gap-3 mt-2 justify-center">
              {statusData.map((s: any) => (
                <div key={s.name} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                  {s.name} {s.value}
                </div>
              ))}
            </div>
          </div>

          {/* 本校内容 Top10 */}
          <div className="bg-white rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-semibold text-gray-800">本校内容 Top10</span>
            </div>
            {topSchools.length === 0 ? (
              <div className="text-xs text-gray-400 py-8 text-center">暂无高校内容数据</div>
            ) : (
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={topSchools} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 10, fill: '#6b7280' }} />
                    <Tooltip />
                    <Bar dataKey="count" name="内容数" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* 待处理举报 */}
        <div className="bg-white rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <div className="text-sm font-semibold text-gray-800">待处理举报</div>
            <button
              onClick={() => navigate('/admin?tab=reports')}
              className="flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-700"
            >
              全部 <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {reports.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">🎉 暂无待处理举报</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {reports.map((r) => (
                <div key={r.id} className="px-5 py-3 flex items-center gap-3">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 shrink-0">
                    {r.targetType === 'question' ? '问题' : r.targetType === 'answer' ? '回答' : r.targetType === 'comment' ? '评论' : r.targetType === 'message' ? '私信' : r.targetType}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-700 truncate">{r.content || r.reason || '无描述'}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {r.reporterName || '匿名'} 举报 · {formatTime(r.createdAt)}
                    </div>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-500 shrink-0">待处理</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 快捷操作 */}
        <div className="bg-white rounded-2xl p-5">
          <div className="text-sm font-semibold text-gray-800 mb-3">快捷操作</div>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: '举报审核', desc: '处理举报队列', to: 'reports' },
              { label: '内容管理', desc: '删除/下架内容', to: 'content' },
              { label: '用户管理', desc: '禁言/封禁账号', to: 'users' },
              { label: '高校管理', desc: '批量导入院校', to: 'universities' },
              { label: '九宫格配置', desc: '专题服务定制', to: 'services' },
              { label: '运营公告', desc: '发布站内公告', to: 'announcements' },
            ].map((q) => (
              <button
                key={q.to}
                onClick={() => navigate(`/admin?tab=${q.to}`)}
                className="text-left p-3.5 rounded-xl bg-gray-50 hover:bg-blue-50 transition-colors"
              >
                <div className="text-xs font-medium text-gray-800">{q.label}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{q.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
