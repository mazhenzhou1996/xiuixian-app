import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useXiuxianStore } from '@/store/useStore';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Seo } from '@/components/Seo';

export default function RegisterPage() {
  usePageTitle('注册');
  const navigate = useNavigate();
  const store = useXiuxianStore();
  const [phone, setPhone] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [school, setSchool] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!/^1\d{10}$/.test(phone.trim())) {
      toast.error('请输入正确的手机号');
      return;
    }
    if (!nickname.trim()) {
      toast.error('请输入昵称');
      return;
    }
    if (nickname.length > 20) {
      toast.error('昵称不能超过20个字符');
      return;
    }
    if (password.length < 6) {
      toast.error('密码至少6位');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('两次密码输入不一致');
      return;
    }
    setLoading(true);
    try {
      await store.register(phone.trim(), nickname.trim(), password, school.trim());
      toast.success('注册成功，欢迎入道！');
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Seo title="注册" noindex />
      <div className="pt-12 pb-8 text-center">
        <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
          <span className="text-white text-xl font-bold">知</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">加入修仙问答</h1>
        <p className="text-xs text-gray-400 mt-1">提问 · 回答 · 论道，开启你的修仙之旅</p>
      </div>

      <div className="flex-1 px-8">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">手机号</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="请输入手机号"
              maxLength={11}
              className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1.5">道号（昵称）</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="给自己取个道号"
              maxLength={20}
              className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1.5">所在高校（选填，用于本校榜）</label>
            <input
              type="text"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="如：武汉大学 / 郑州大学"
              maxLength={30}
              className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1.5">密码</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少6位"
                className="w-full h-11 px-4 pr-12 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
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

          <div>
            <label className="block text-sm text-gray-600 mb-1.5">确认密码</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入密码"
              className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-blue-600 text-white font-medium rounded-xl shadow-md shadow-blue-500/20 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-60 mt-2"
          >
            {loading ? '注册中...' : '注 册'}
          </button>
        </form>

        <div className="text-center mt-5 text-sm text-gray-500">
          已有账号？
          <Link to="/login" className="text-blue-600 font-medium ml-1">
            去登录
          </Link>
        </div>
      </div>
    </div>
  );
}
