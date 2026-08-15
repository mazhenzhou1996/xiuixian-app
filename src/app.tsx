import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Layout } from '@/components/Layout';
import { Spinner } from '@/components/ui/spinner';

// 路由级代码分割：各页面按需加载，减小首屏 bundle
const NotFoundPage = lazy(() => import('@/pages/notfoundpage/notfoundpage'));
const HomePage = lazy(() => import('@/pages/homepage/homepage'));
const HotPage = lazy(() => import('@/pages/hotpage/hotpage'));
const RankPage = lazy(() => import('@/pages/rankpage/rankpage'));
const SearchPage = lazy(() => import('@/pages/searchpage/searchpage'));
const LoginPage = lazy(() => import('@/pages/loginpage/loginpage'));
const RegisterPage = lazy(() => import('@/pages/registerpage/registerpage'));
const AskPage = lazy(() => import('@/pages/askpage/askpage'));
const QuestionDetailPage = lazy(() => import('@/pages/questiondetailpage/questiondetailpage'));
const CommentsPage = lazy(() => import('@/pages/commentspage/commentspage'));
const MessagesPage = lazy(() => import('@/pages/messagespage/messagespage'));
const ProfilePage = lazy(() => import('@/pages/profilepage/profilepage'));
const AnswerEditorPage = lazy(() => import('@/pages/answereditorpage/answereditorpage'));
const MyQuestionsPage = lazy(() => import('@/pages/myquestionspage/myquestionspage'));
const MyAnswersPage = lazy(() => import('@/pages/myanswerspage/myanswerspage'));
const MyFavoritesPage = lazy(() => import('@/pages/myfavoritespage/myfavoritespage'));
const MyInvitesPage = lazy(() => import('@/pages/myinvitespage/myinvitespage'));
const LostFoundPage = lazy(() => import('@/pages/lostfoundpage/lostfoundpage'));
const BeautyContestPage = lazy(() => import('@/pages/beautycontestpage/beautycontestpage'));
const ConfessionWallPage = lazy(() => import('@/pages/confessionwallpage/confessionwallpage'));
const MyLikesPage = lazy(() => import('@/pages/mylikespage/mylikespage'));
const MyHistoryPage = lazy(() => import('@/pages/myhistorypage/myhistorypage'));
const MessageListPage = lazy(() => import('@/pages/messagelistpage/messagelistpage'));
const TrashPage = lazy(() => import('@/pages/trashpage/trashpage'));
const SettingsPage = lazy(() => import('@/pages/settingspage/settingspage'));
const ProfileSettingsPage = lazy(() => import('@/pages/profilesettingspage/profilesettingspage'));
const PrivacySettingsPage = lazy(() => import('@/pages/privacysettingspage/privacysettingspage'));
const AccountSettingsPage = lazy(() => import('@/pages/accountsettingspage/accountsettingspage'));
const GeneralSettingsPage = lazy(() => import('@/pages/generalsettingspage/generalsettingspage'));
const FollowPage = lazy(() => import('@/pages/followpage/followpage'));
const UserProfilePage = lazy(() => import('@/pages/userprofilepage/userprofilepage'));
const PrivateMessagesPage = lazy(() => import('@/pages/privatemessagespage/privatemessagespage'));
const PrivateChatPage = lazy(() => import('@/pages/privatechatpage/privatechatpage'));
const TopicPage = lazy(() => import('@/pages/topicpage/topicpage'));
const UniversityPage = lazy(() => import('@/pages/universitypage/universitypage'));
const GraduatePage = lazy(() => import('@/pages/graduatepage/graduatepage'));
const AdminPage = lazy(() => import('@/pages/admin/adminpage'));
const CreditPage = lazy(() => import('@/pages/creditpage/creditpage'));
const ServiceContentPage = lazy(() => import('@/pages/servicecontentpage/servicecontentpage'));
const AdminUniContentPage = lazy(() => import('@/pages/admin/adminuniversitycontentpage'));
const ConsultationCenterPage = lazy(() => import('@/pages/consultationcenterpage/consultationcenterpage'));
const BountyPage = lazy(() => import('@/pages/bountypage/bountypage'));
const RecyclePage = lazy(() => import('@/pages/recyclepage/recyclepage'));
const MyEarningsPage = lazy(() => import('@/pages/myearningspage/myearningspage'));
const SchoolCirclePage = lazy(() => import('@/pages/schoolcirclepage/schoolcirclepage'));
const NotificationsPage = lazy(() => import('@/pages/notificationspage/notificationspage'));

// 路由切换时回到页面顶部（避免新页面停留在上次滚动位置）
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);
  return null;
}

function PageFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-gray-50">
      <Spinner className="text-blue-600" />
    </div>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="hot" element={<HotPage />} />
            <Route path="rank" element={<RankPage />} />
            <Route path="follow" element={<FollowPage />} />
            <Route path="user/:id" element={<UserProfilePage />} />
            <Route path="topic/university" element={<UniversityPage />} />
            <Route path="topic/graduate" element={<GraduatePage />} />
            <Route path="topic/:id" element={<TopicPage />} />
<Route path="topic/school/:id" element={<SchoolCirclePage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="ask" element={<AskPage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="question/:id" element={<QuestionDetailPage />} />
            <Route path="comments/:answerId" element={<CommentsPage />} />
            <Route path="answer/:questionId" element={<AnswerEditorPage />} />
            <Route path="my/questions" element={<MyQuestionsPage />} />
            <Route path="my/answers" element={<MyAnswersPage />} />
            <Route path="my/favorites" element={<MyFavoritesPage />} />
<Route path="my/invites" element={<MyInvitesPage />} />
<Route path="lost" element={<LostFoundPage />} />
<Route path="beauty" element={<BeautyContestPage />} />
<Route path="wall" element={<ConfessionWallPage />} />
            <Route path="my/likes" element={<MyLikesPage />} />
            <Route path="my/history" element={<MyHistoryPage />} />
            <Route path="messages/trash" element={<TrashPage />} />
            <Route path="messages/private" element={<PrivateMessagesPage />} />
            <Route path="messages/private/:userId" element={<PrivateChatPage />} />
            <Route path="messages/:type" element={<MessageListPage />} />
            <Route path="credit" element={<CreditPage />} />
<Route path="my/earnings" element={<MyEarningsPage />} />
            <Route path="consult-center" element={<ConsultationCenterPage />} />
            <Route path="bounty" element={<BountyPage />} />
            <Route path="bounty/:id" element={<BountyPage />} />
            <Route path="recycle" element={<RecyclePage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="service/:serviceId" element={<ServiceContentPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="settings/profile" element={<ProfileSettingsPage />} />
            <Route path="settings/privacy" element={<PrivacySettingsPage />} />
            <Route path="settings/account" element={<AccountSettingsPage />} />
            <Route path="settings/general" element={<GeneralSettingsPage />} />
            <Route path="admin/uni-content/:id" element={<AdminUniContentPage />} />
            <Route path="admin/*" element={<AdminPage />} />
          </Route>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            borderRadius: '12px',
            fontSize: '14px',
            // 提示信息居中显示（视口垂直 40% 处）
            marginTop: '40vh',
          },
        }}
      />
    </>
  );
}
