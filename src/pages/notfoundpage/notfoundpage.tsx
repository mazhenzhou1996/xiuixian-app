import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const [kw, setKw] = useState('');
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 min-h-[70vh] bg-gray-50">
      <div className="text-6xl font-bold mb-2 text-gray-200">404</div>
      <p className="text-gray-500 mb-6 text-sm">页面不存在或已被删除</p>
      <form
        onSubmit={(e) => { e.preventDefault(); if (kw.trim()) navigate('/search?q=' + encodeURIComponent(kw.trim())); }}
        className="w-full max-w-sm mb-6"
      >
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 h-11 shadow-sm">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            placeholder="搜索你感兴趣的内容..."
            className="flex-1 bg-transparent outline-none text-sm min-w-0"
          />
          <button type="submit" className="text-xs text-[#0084FF] font-medium shrink-0">搜索</button>
        </div>
      </form>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link to="/" className="px-4 py-2 rounded-full bg-[#0084FF] text-white text-xs font-medium hover:bg-[#0066CC] transition-colors">返回首页</Link>
        <Link to="/hot" className="px-4 py-2 rounded-full bg-white border border-gray-200 text-gray-600 text-xs font-medium hover:border-[#0084FF] hover:text-[#0084FF] transition-colors">热榜</Link>
        <Link to="/topic/university" className="px-4 py-2 rounded-full bg-white border border-gray-200 text-gray-600 text-xs font-medium hover:border-[#0084FF] hover:text-[#0084FF] transition-colors">大学专题</Link>
        <Link to="/wall" className="px-4 py-2 rounded-full bg-white border border-gray-200 text-gray-600 text-xs font-medium hover:border-[#0084FF] hover:text-[#0084FF] transition-colors">表白墙</Link>
      </div>
    </div>
  );
}
