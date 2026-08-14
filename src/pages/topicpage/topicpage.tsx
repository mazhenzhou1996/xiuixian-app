import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { GraduationCap, BookOpen, Briefcase } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import QuestionCard from '@/components/QuestionCard';
import { useXiuxianStore } from '@/store/useStore';
import { usePageTitle } from '@/hooks/usePageTitle';

const TOPIC_META: Record<string, { title: string; desc: string; keywords: string[]; icon: typeof GraduationCap; gradient: string }> = {
  university: {
    title: '大学专题',
    desc: '学长学姐分享：适应校园、学业规划、科研竞赛、专业选择',
    keywords: ['大学', '学长', '校园', '专业', '科研', '竞赛', '保研', '社团'],
    icon: GraduationCap,
    gradient: 'from-blue-600 to-indigo-500',
  },
  gaokao: {
    title: '高考专题',
    desc: '高考复习、志愿填报：冲刺策略、心态调整、选校选专业',
    keywords: ['高考', '复习', '志愿', '填报', '冲刺', '模考', '分数'],
    icon: BookOpen,
    gradient: 'from-amber-500 to-orange-500',
  },
  job: {
    title: '就业专题',
    desc: '找实习、做简历、找工作：实习入门、简历优化、面试经验',
    keywords: ['实习', '简历', '工作', '面试', '就业', '秋招', '求职', 'offer'],
    icon: Briefcase,
    gradient: 'from-emerald-600 to-teal-500',
  },
};

export default function TopicPage() {
  const { id = '' } = useParams<{ id: string }>();
  const meta = TOPIC_META[id] || TOPIC_META.university;
  usePageTitle(meta.title);
  const store = useXiuxianStore();

  const questions = useMemo(() => {
    const qs = store.getQuestions();
    const kw = meta.keywords;
    return qs.filter((q: any) => {
      const text = `${q.title} ${q.content}`;
      return kw.some((k) => text.includes(k));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, id]);

  const Icon = meta.icon;

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title={meta.title} />

      {/* 专题头 */}
      <div className={`bg-gradient-to-r ${meta.gradient} px-4 py-5 text-white`}>
        <div className="flex items-center gap-3">
          <Icon className="w-9 h-9 shrink-0 opacity-90" />
          <div>
            <div className="text-lg font-bold">{meta.title}</div>
            <div className="text-xs text-white/85 mt-1">{meta.desc}</div>
          </div>
        </div>
      </div>

      {/* 相关问题 */}
      <div className="pt-1">
        {questions.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm">
            该专题暂无内容，去提问吧
          </div>
        ) : (
          <div className="bg-white divide-y divide-gray-100 border-t border-b border-gray-100">
            {questions.map((q) => (
              <QuestionCard key={q.id} question={q} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
