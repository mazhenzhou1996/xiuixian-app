import { useNavigate } from 'react-router-dom';
import { Shield, KeyRound, Image, ChevronRight } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { usePageTitle } from '@/hooks/usePageTitle';

const GROUPS = [
  {
    title: '隐私',
    items: [
      { label: '隐私设置', desc: '关注列表可见性、一键防护', icon: Shield, color: 'text-green-600 bg-green-50', path: '/settings/privacy' },
    ],
  },
  {
    title: '账号与通用',
    items: [
      { label: '账号设置', desc: '修改密码、绑定邮箱', icon: KeyRound, color: 'text-amber-600 bg-amber-50', path: '/settings/account' },
      { label: '基本设置', desc: '图片加载模式', icon: Image, color: 'text-purple-600 bg-purple-50', path: '/settings/general' },
    ],
  },
];

export default function SettingsPage() {
  usePageTitle('设置');
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="设置" />
      <div className="px-4 py-3 space-y-4">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div className="text-xs text-gray-400 px-1 pb-1.5">{g.title}</div>
            <div className="bg-white rounded-xl divide-y divide-gray-50 overflow-hidden">
              {g.items.map((item) => (
                <div
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className={`w-9 h-9 rounded-full ${item.color} flex items-center justify-center shrink-0`}>
                    <item.icon className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-700">{item.label}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{item.desc}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
