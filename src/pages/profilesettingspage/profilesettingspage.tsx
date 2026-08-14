import { useState, useEffect, useRef } from 'react';
import { School, ChevronDown, Check } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Avatar from '@/components/Avatar';
import { useXiuxianStore } from '@/store/useStore';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function ProfileSettingsPage() {
  usePageTitle('个人信息');
  const store = useXiuxianStore();
  const currentUser = store.getCurrentUser();
  const [avatar, setAvatar] = useState('');
  const [nickname, setNickname] = useState('');
  const [location, setLocation] = useState('');
  const [school, setSchool] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // v16：学校库选择（统一圈子绑定）
  const [schools, setSchools] = useState<any[]>([]);
  const [schoolOpen, setSchoolOpen] = useState(false);
  const [schoolKeyword, setSchoolKeyword] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | null>(null);

  useEffect(() => {
    store.listSchools().then((list: any[]) => setSchools(list || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    setNickname(currentUser.nickname || '');
    setBio(currentUser.bio || '');
    setAvatar(currentUser.avatar || '');
    const s = store.getSettings();
    setLocation(s.location || '');
    setSchool(s.school || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="个人信息" />
        <div className="text-center py-20 text-gray-400 text-sm">登录后编辑个人信息</div>
      </div>
    );
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast.error('图片不能超过 500KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSave = async () => {
    if (!nickname.trim()) {
      toast.error('网名不能为空');
      return;
    }
    setSaving(true);
    try {
      const update: any = { nickname: nickname.trim(), bio: bio.trim() };
      if (avatar && avatar.startsWith('data:')) {
        update.avatar = avatar;
      }
      await supabase.from('profiles').update(update).eq('id', currentUser.id);
      store.setSetting('location', location.trim());
      // v16：选过学校库 → 走 RPC 持久化 school_id + 圈子绑定；纯文本 → 兼容旧逻辑
      if (selectedSchoolId) {
        try {
          await api.saveMySchool(selectedSchoolId);
        } catch (e: any) {
          toast.error(e?.message || '学校保存失败');
        }
      } else {
        store.setSetting('school', school.trim());
      }
      toast.success('保存成功');
      store.logout();
      setTimeout(() => window.location.reload(), 600);
    } catch {
      toast.error('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full h-10 px-3 bg-gray-50 rounded-lg text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-200 border border-transparent focus:border-blue-300';

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="个人信息"
        rightAction={
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-7 px-3 bg-blue-600 text-white text-xs font-medium rounded-full disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        }
      />
      <div className="px-4 py-3 space-y-3">
        {/* 头像 */}
        <div className="bg-white rounded-xl p-4 flex items-center gap-4">
          <Avatar
            src={avatar}
            alt={nickname || '道友'}
            className="w-16 h-16"
            bgClass="bg-gradient-to-br from-blue-500 to-indigo-500"
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-700 mb-1">头像</div>
            <div className="text-xs text-gray-400 mb-2">支持 JPG/PNG，不超过 500KB</div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="h-8 px-4 rounded-full bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 transition-colors"
            >
              选择图片
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">网名</label>
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20} className={inputCls} placeholder="请输入网名" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">位置</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={30} className={inputCls} placeholder="如：东荒大陆 青云城" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">学校</label>
            <input value={school} onChange={(e) => { setSchool(e.target.value); setSelectedSchoolId(null); }} maxLength={30} className={inputCls} placeholder="如：青云学府" />
            {/* 从高校库选择（v16：统一圈子绑定） */}
            <div className="mt-2">
              <button
                onClick={() => setSchoolOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
              >
                <School className="w-3.5 h-3.5" />
                从高校库选择（进入本校圈子）
                <ChevronDown className={`w-3 h-3 transition-transform ${schoolOpen ? 'rotate-180' : ''}`} />
              </button>
              {schoolOpen && (
                <div className="mt-2 bg-white border border-gray-200 rounded-xl p-2 max-h-56 overflow-y-auto">
                  <input
                    type="text"
                    value={schoolKeyword}
                    onChange={(e) => setSchoolKeyword(e.target.value)}
                    placeholder="搜索学校名称"
                    className="w-full h-9 px-3 bg-gray-50 rounded-lg text-sm outline-none mb-1"
                  />
                  {(schools || []).filter((s: any) => !schoolKeyword || s.name.includes(schoolKeyword)).slice(0, 20).map((s: any) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSchool(s.name);
                        setSelectedSchoolId(s.id);
                        setSchoolOpen(false);
                        setSchoolKeyword('');
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-blue-50 flex items-center justify-between"
                    >
                      <span className="truncate">{s.name}</span>
                      {selectedSchoolId === s.id && <Check className="w-4 h-4 text-blue-500" />}
                    </button>
                  ))}
                  {(schools || []).length === 0 && (
                    <div className="px-3 py-3 text-xs text-gray-400 text-center">加载中...</div>
                  )}
                </div>
              )}
              {selectedSchoolId && (
                <div className="mt-1.5 text-[11px] text-green-600 flex items-center gap-1">
                  <Check className="w-3 h-3" /> 已绑定该校圈子，保存后生效
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">简介</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={100}
              rows={3}
              className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-200 resize-none"
              placeholder="介绍一下自己吧"
            />
            <div className="text-right text-xs text-gray-400 mt-1">{bio.length}/100</div>
          </div>
        </div>
      </div>
    </div>
  );
}
