import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useXiuxianStore } from '@/store/useStore';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Seo } from '@/components/Seo';

export default function LoginPage() {
  usePageTitle('登录');
  const navigate = useNavigate();
  const store = useXiuxianStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error('请输入正确的邮箱');
      return;
    }
    if (!password) {
      toast.error('请输入密码');
      return;
    }

    setLoading(true);
    try {
      await store.login(email.trim(), password);
      toast.success('登录成功');
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Seo title="登录" noindex />
      {/* 返回主页大按钮 */}
      <div className="px-4 pt-4">
        <button
          onClick={() => navigate('/', { replace: true })}
          className="w-full h-11 rounded-xl bg-gray-50 border border-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-100 transition-colors"
        >
          ← 返回主页
        </button>
      </div>

      {/* Logo area */}
      <div className="pt-8 pb-10 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#0084FF] flex items-center justify-center shadow-lg shadow-[#0084FF]/30">
          <span className="text-white text-2xl font-bold">知</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">修仙问答</h1>
        <p className="text-sm text-gray-400 mt-1">修仙路上，与同道共前行</p>
      </div>

      {/* Form */}
      <div className="flex-1 px-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="请输入邮箱"
              className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-[#0084FF] focus:ring-2 focus:ring-[#0084FF]/15 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1.5">密码</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="w-full h-12 px-4 pr-12 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-[#0084FF] focus:ring-2 focus:ring-[#0084FF]/15 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="text-right">
            <button type="button" className="text-xs text-[#0084FF]">
              忘记密码？
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-[#0084FF] text-white font-medium rounded-xl shadow-md shadow-[#0084FF]/20 hover:bg-[#0066CC] active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {loading ? '登录中...' : '登 录'}
          </button>
        </form>

        <div className="text-center mt-6 text-sm text-gray-500">
          还没有账号？
          <Link to="/register" className="text-[#0084FF] font-medium ml-1">
            去注册
          </Link>
        </div>

      </div>
    </div>
  );
}
