import { useState, useEffect } from 'react';
import PageHeader from '@/components/PageHeader';
import { useXiuxianStore } from '@/store/useStore';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
        checked ? 'bg-blue-600' : 'bg-gray-200'
      }`}
      aria-pressed={checked}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

export default function PrivacySettingsPage() {
  usePageTitle('隐私设置');
  const store = useXiuxianStore();
  const [followersVisible, setFollowersVisible] = useState(true);
  const [followingVisible, setFollowingVisible] = useState(true);
  const [guardOn, setGuardOn] = useState(false);
  const [hideContent, setHideContent] = useState(false);
  const [enablePersonalized, setEnablePersonalized] = useState(true);

  useEffect(() => {
    const s = store.getSettings();
    setFollowersVisible(s.followersVisible !== false);
    setFollowingVisible(s.followingVisible !== false);
    setGuardOn(!!s.guardOn);
    setHideContent(store.prefs.hideContent);
    setEnablePersonalized(store.prefs.enablePersonalized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (key: string, value: any) => {
    store.setSetting(key, value);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="隐私设置" />
      <div className="px-4 py-3 space-y-3">
        {/* 关注列表可见性 */}
        <div className="bg-white rounded-xl p-4 space-y-4">
          <div className="text-sm font-medium text-gray-700">关注列表可见性</div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-700">关注者列表</div>
              <div className="text-xs text-gray-400 mt-0.5">谁可以查看关注你的人</div>
            </div>
            <Toggle
              checked={followersVisible}
              onChange={(v) => { setFollowersVisible(v); update('followersVisible', v); toast.success(v ? '关注者列表已设为可见' : '关注者列表已设为不可见'); }}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-700">关注了列表</div>
              <div className="text-xs text-gray-400 mt-0.5">谁可以查看你关注的人</div>
            </div>
            <Toggle
              checked={followingVisible}
              onChange={(v) => { setFollowingVisible(v); update('followingVisible', v); toast.success(v ? '关注了列表已设为可见' : '关注了列表已设为不可见'); }}
            />
          </div>
        </div>

        {/* 一键防护 */}
        <div className="bg-white rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-700">一键防护</div>
              <div className="text-xs text-gray-400 mt-0.5">
                开启后不接受任何人的私信和评论
              </div>
            </div>
            <Toggle
              checked={guardOn}
              onChange={(v) => { setGuardOn(v); update('guardOn', v); toast.success(v ? '一键防护已开启' : '一键防护已关闭'); }}
            />
          </div>
        </div>

        {/* 隐藏主页内容（数据库级，全端生效） */}
        <div className="bg-white rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-700">隐藏主页内容</div>
              <div className="text-xs text-gray-400 mt-0.5">
                开启后，你的个人主页将不再展示提问和回答（你自己可见）
              </div>
            </div>
            <Toggle
              checked={hideContent}
              onChange={async (v) => {
                setHideContent(v);
                try {
                  await store.updatePrefs({ hideContent: v });
                  toast.success(v ? '主页内容已隐藏' : '主页内容已公开');
                } catch (e: any) {
                  setHideContent(!v);
                  toast.error(e?.message || '设置失败');
                }
              }}
            />
          </div>
        </div>

        {/* 个性化推荐开关 */}
        <div className="bg-white rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-700">个性化推荐</div>
              <div className="text-xs text-gray-400 mt-0.5">
                开启后优先推荐本校问题与关注道人的内容；关闭后仅按热度推荐
              </div>
            </div>
            <Toggle
              checked={enablePersonalized}
              onChange={async (v) => {
                setEnablePersonalized(v);
                try {
                  await store.updatePrefs({ enablePersonalized: v });
                  toast.success(v ? '个性化推荐已开启' : '个性化推荐已关闭');
                } catch (e: any) {
                  setEnablePersonalized(!v);
                  toast.error(e?.message || '设置失败');
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
