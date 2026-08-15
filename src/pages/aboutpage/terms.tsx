import { usePageTitle } from '@/hooks/usePageTitle';
import PageHeader from '@/components/PageHeader';
import { Seo } from '@/components/Seo';

export default function 用户协议() {
  usePageTitle('用户协议');
  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <Seo title="用户协议 - 修仙问答" noindex />
      <PageHeader title="用户协议" />
      <div className="px-4 py-4">
        <div className="bg-white rounded-2xl p-5 text-sm text-gray-600 leading-relaxed space-y-3">
          <h2 className="text-base font-bold text-gray-800">修仙问答用户协议</h2>
          <p>更新日期：2026-08-15</p>
          <p>欢迎使用修仙问答。使用本平台即表示您同意以下条款：</p>
          <h3 className="font-semibold text-gray-800">一、账号与注册</h3>
          <p>1. 注册需提供真实有效的邮箱，并设置密码；</p>
          <p>2. 您应对账号下的所有行为负责，不得出借、转让账号；</p>
          <p>3. 如账号涉嫌违规，平台有权暂停或封禁。</p>
          <h3 className="font-semibold text-gray-800">二、内容规范</h3>
          <p>1. 您发布的内容需合法合规，不得包含违法信息、人身攻击、虚假信息、广告刷屏等；</p>
          <p>2. 匿名发布同样受平台审核与规则约束；</p>
          <p>3. 平台有权对违规内容进行下架、删除，并对账号采取处罚。</p>
          <h3 className="font-semibold text-gray-800">三、付费功能</h3>
          <p>1. 付费咨询、赞赏、悬赏、置顶等服务使用平台余额支付；</p>
          <p>2. 虚拟服务一经使用（如置顶、精选）原则上不支持退款；</p>
          <p>3. 如遇欺诈、虚假服务，可通过客服申诉，平台核实后退还余额。</p>
          <h3 className="font-semibold text-gray-800">四、知识产权</h3>
          <p>1. 您发布的内容版权归您所有，同时授予平台在平台内展示、分发之许可；</p>
          <p>2. 平台名称、标识、界面设计等归平台所有。</p>
          <h3 className="font-semibold text-gray-800">五、免责声明</h3>
          <p>1. 平台内容由用户生成，观点不代表平台立场；</p>
          <p>2. 付费咨询内容仅供参考，不构成专业建议；</p>
          <p>3. 因不可抗力（网络故障、自然灾害等）导致的服务中断，平台不承担赔偿责任。</p>
          <h3 className="font-semibold text-gray-800">六、协议变更</h3>
          <p>平台可适时修订本协议，重大变更将在站内公告。继续使用即视为接受修订后的协议。</p>
        </div>
      </div>
    </div>
  );
}
