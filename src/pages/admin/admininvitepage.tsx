import { useState } from 'react';
import { Ticket, Copy, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

export default function AdminInvitePage() {
  const [count, setCount] = useState(10);
  const [note, setNote] = useState('公测批次');
  const [maxUses, setMaxUses] = useState(1);
  const [codes, setCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const list = await api.generateInviteCodes(count, note, maxUses);
      setCodes(list);
      toast.success(`已生成 ${list.length} 个邀请码`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '生成失败');
    } finally {
      setLoading(false);
    }
  };

  const copyAll = () => {
    navigator.clipboard?.writeText(codes.join('\n')).then(
      () => toast.success('已复制全部邀请码'),
      () => toast.error('复制失败'),
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-5 border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Ticket className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold text-gray-900">邀请码管理</h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          公测采用邀请制注册（防水军/批量注册）。生成后把邀请码发给高校推广渠道即可。
        </p>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">数量</label>
            <input
              type="number"
              min={1}
              max={500}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
              className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">单码可用次数</label>
            <input
              type="number"
              min={1}
              max={999}
              value={maxUses}
              onChange={(e) => setMaxUses(Math.max(1, Number(e.target.value) || 1))}
              className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">备注</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="如：武汉大学推广"
              className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm"
            />
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="h-10 px-5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? '生成中...' : '生成邀请码'}
        </button>
      </div>

      {codes.length > 0 && (
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">本次生成（{codes.length}）</h3>
            <button onClick={copyAll} className="text-xs text-blue-600 flex items-center gap-1">
              <Copy className="w-3.5 h-3.5" /> 复制全部
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {codes.map((c) => (
              <code key={c} className="text-center text-sm bg-gray-50 border border-gray-100 rounded-md py-2 font-mono tracking-wider">
                {c}
              </code>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
