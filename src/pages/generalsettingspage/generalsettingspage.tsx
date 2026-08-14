import { useState, useEffect } from 'react';
import PageHeader from '@/components/PageHeader';
import { useXiuxianStore } from '@/store/useStore';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';

const MODES = [
  { key: 'off', label: '不加载', desc: '不加载任何图片，最省流量' },
  { key: 'blur', label: '低流量模糊加载', desc: '图片先模糊显示，省流量' },
  { key: 'normal', label: '正常加载', desc: '图片清晰显示' },
];

export default function GeneralSettingsPage() {
  usePageTitle('基本设置');
  const store = useXiuxianStore();
  const [mode, setMode] = useState('normal');

  useEffect(() => {
    setMode(store.getImageMode());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (key: string) => {
    setMode(key);
    store.setImageMode(key);
    toast.success(`图片加载已切换为「${MODES.find((m) => m.key === key)?.label}」`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="基本设置" />
      <div className="px-4 py-3">
        <div className="text-xs text-gray-400 px-1 pb-2">图片加载</div>
        <div className="bg-white rounded-xl divide-y divide-gray-50 overflow-hidden">
          {MODES.map((m) => {
            const active = mode === m.key;
            return (
              <div
                key={m.key}
                onClick={() => handleSelect(m.key)}
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className={`text-sm ${active ? 'text-blue-600 font-medium' : 'text-gray-700'}`}>
                    {m.label}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{m.desc}</div>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    active ? 'border-blue-600' : 'border-gray-200'
                  }`}
                >
                  {active && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
