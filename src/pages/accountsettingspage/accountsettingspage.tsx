import { useState, useEffect } from 'react';
import PageHeader from '@/components/PageHeader';
import { useXiuxianStore } from '@/store/useStore';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function AccountSettingsPage() {
  usePageTitle('账号设置');
  const store = useXiuxianStore();
  const currentUser = store.getCurrentUser();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email.replace(/@xiuixian\.app$/, ''));
    });
  }, []);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="账号设置" />
        <div className="text-center py-20 text-gray-400 text-sm">登录后进行账号设置</div>
      </div>
    );
  }

  const handleChangePassword = async () => {
    if (!oldPassword) { toast.error('请输入当前密码'); return; }
    if (!newPassword || newPassword.length < 6) { toast.error('新密码至少 6 位'); return; }
    setLoading(true);
    try {
      // 用当前手机号+旧密码重新登录验证，再更新密码
      await supabase.auth.signInWithPassword({ email: currentUser.phone + '@xiuixian.app', password: oldPassword });
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('密码修改成功');
      setOldPassword('');
      setNewPassword('');
    } catch {
      toast.error('修改失败，请检查当前密码是否正确');
    } finally {
      setLoading(false);
    }
  };

  const handleBindEmail = async () => {
    const e = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { toast.error('请输入正确的邮箱地址'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: e });
      if (error) throw error;
      toast.success('绑定成功，请到新邮箱确认');
    } catch {
      toast.error('绑定失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full h-10 px-3 bg-gray-50 rounded-lg text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-200 border border-transparent focus:border-blue-300';

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="账号设置" />
      <div className="px-4 py-3 space-y-3">
        <div className="bg-white rounded-xl p-4 space-y-3">
          <div className="text-sm font-medium text-gray-700">修改密码</div>
          <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className={inputCls} placeholder="当前密码" />
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} placeholder="新密码（至少 6 位）" />
          <button
            onClick={handleChangePassword}
            disabled={loading}
            className="w-full h-9 bg-blue-600 text-white text-sm font-medium rounded-full disabled:opacity-50"
          >
            确认修改
          </button>
        </div>

        <div className="bg-white rounded-xl p-4 space-y-3">
          <div className="text-sm font-medium text-gray-700">绑定邮箱</div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="输入邮箱地址" />
          <button
            onClick={handleBindEmail}
            disabled={loading}
            className="w-full h-9 bg-white text-blue-600 text-sm font-medium rounded-full border border-blue-200 disabled:opacity-50"
          >
            绑定
          </button>
        </div>
      </div>
    </div>
  );
}
