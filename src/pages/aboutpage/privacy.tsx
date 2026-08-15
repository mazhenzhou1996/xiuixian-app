import { usePageTitle } from '@/hooks/usePageTitle';
import PageHeader from '@/components/PageHeader';
import { Seo } from '@/components/Seo';

export default function 隐私政策() {
  usePageTitle('隐私政策');
  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <Seo title="隐私政策 - 修仙问答" noindex />
      <PageHeader title="隐私政策" />
      <div className="px-4 py-4">
        <div className="bg-white rounded-2xl p-5 text-sm text-gray-600 leading-relaxed space-y-3">
          <h2 className="text-base font-bold text-gray-800">修仙问答隐私政策</h2>
          <p>更新日期：2026-08-15</p>
          <p>修仙问答（以下简称"本平台"）重视用户隐私。本政策说明我们收集、使用和保护信息的方式。</p>
          <h3 className="font-semibold text-gray-800">一、收集的信息</h3>
          <p>1. 账号信息：注册时提供的邮箱、昵称、所在高校（选填）。</p>
          <p>2. 内容信息：您发布的问题、回答、评论、私信、表白、悬赏等内容。</p>
          <p>3. 行为信息：收藏、点赞、关注、浏览记录等互动数据（仅用于功能实现与推荐）。</p>
          <p>4. 支付信息：付费咨询、赞赏等交易记录；支付由第三方渠道处理，本平台不存储您的支付账户信息。</p>
          <h3 className="font-semibold text-gray-800">二、信息的使用</h3>
          <p>1. 用于提供、维护和改进平台功能；</p>
          <p>2. 用于内容审核与社区安全（垃圾信息、违规内容治理）；</p>
          <p>3. 经您同意后用于个性化推荐。</p>
          <h3 className="font-semibold text-gray-800">三、信息的存储与保护</h3>
          <p>1. 数据存储于安全的云端数据库，采用传输加密（HTTPS/WSS）与访问控制；</p>
          <p>2. 我们不会向第三方出售您的个人信息；</p>
          <p>3. 依法配合监管要求，仅在法律规定的范围内披露。</p>
          <h3 className="font-semibold text-gray-800">四、您的权利</h3>
          <p>您可随时在「设置」中修改资料、开启隐私保护（隐藏主页内容、关闭个性化推荐）、删除自己发布的内容。</p>
          <h3 className="font-semibold text-gray-800">五、未成年人保护</h3>
          <p>本平台面向高校学生群体，如您未满 18 周岁，请在监护人指导下使用。</p>
          <h3 className="font-semibold text-gray-800">六、联系我们</h3>
          <p>如对本政策有任何疑问，可通过官方 QQ 群或客服入口联系我们。</p>
        </div>
      </div>
    </div>
  );
}
