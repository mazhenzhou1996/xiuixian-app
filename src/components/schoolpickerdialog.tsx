import { useState, useEffect, useMemo } from 'react';
import { GraduationCap, Search, Check } from 'lucide-react';
import { publicTopic } from '@/lib/adminapi';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface SchoolPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (school: any) => void;
  selectedId?: number | null;
  title?: string;
  description?: string;
}

/**
 * 学校选择弹窗（v30 升级）
 * - 省份筛选 + 关键词搜索
 * - 选中后回调，由调用方决定存储/跳转
 */
export default function SchoolPickerDialog({
  open, onClose, onSelect, selectedId, title = '选择学校', description = '按省份筛选或直接搜索学校名称',
}: SchoolPickerDialogProps) {
  const [schools, setSchools] = useState<any[]>([]);
  const [keyword, setKeyword] = useState('');
  const [province, setProvince] = useState('全部');

  useEffect(() => {
    if (!open) return;
    publicTopic.getUniversities().then((list) => setSchools(list || [])).catch(() => {});
    setKeyword('');
    setProvince('全部');
  }, [open]);

  const provinces = useMemo(() => {
    const set = new Set<string>();
    (schools || []).forEach((s: any) => s.province && set.add(s.province));
    return ['全部', ...Array.from(set).sort()];
  }, [schools]);

  const filtered = useMemo(() => {
    let list = schools || [];
    if (province !== '全部') list = list.filter((s: any) => s.province === province);
    const kw = keyword.trim();
    if (kw) list = list.filter((s: any) => s.name.includes(kw) || (s.city || '').includes(kw));
    return list.slice(0, 60);
  }, [schools, province, keyword]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4 text-blue-600" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* 搜索框 */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="输入学校名称或城市直接搜索"
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-gray-50 border border-gray-200 text-sm outline-none focus:border-blue-400 focus:bg-white transition-colors"
          />
        </div>

        {/* 省份筛选 */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {provinces.map((p) => (
            <button
              key={p}
              onClick={() => setProvince(p)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                province === p ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* 学校列表 */}
        <div className="max-h-72 overflow-y-auto divide-y divide-gray-50 -mx-1 px-1">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">没有找到匹配的学校</div>
          ) : (
            filtered.map((s: any) => (
              <div
                key={s.id}
                onClick={() => { onSelect(s); onClose(); }}
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-blue-50/60 rounded-lg transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                  <GraduationCap className="w-4.5 h-4.5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-700 font-medium truncate">{s.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {s.province || ''}{s.city ? ` · ${s.city}` : ''}
                    {(s.tags || []).length > 0 && ` · ${(s.tags || []).join(' · ')}`}
                  </div>
                </div>
                {selectedId != null && Number(s.id) === Number(selectedId) && (
                  <Check className="w-4 h-4 text-blue-600 shrink-0" />
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
