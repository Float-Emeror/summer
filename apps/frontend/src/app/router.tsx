import { Suspense, lazy } from 'react';
import { Navigate, createBrowserRouter } from 'react-router-dom';
import { PageShell } from '../shared/components/PageShell';
import { RequireAuth } from '../shared/auth/RequireAuth';
import { DataState } from '../shared/components/DataState';
import { RouteErrorBoundaryWithLocation } from '../shared/components/RouteErrorBoundary';

const AdminPage = lazy(() => import('../pages/AdminPage').then((module) => ({ default: module.AdminPage })));
const AiWorkbenchPage = lazy(() => import('../pages/AiWorkbenchPage').then((module) => ({ default: module.AiWorkbenchPage })));
const ChatPage = lazy(() => import('../pages/ChatPage').then((module) => ({ default: module.ChatPage })));
const CreateTeamPage = lazy(() => import('../pages/CreateTeamPage').then((module) => ({ default: module.CreateTeamPage })));
const LoginPage = lazy(() => import('../pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const NotificationsPage = lazy(() => import('../pages/NotificationsPage').then((module) => ({ default: module.NotificationsPage })));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })));
const ProfilePage = lazy(() => import('../pages/ProfilePage').then((module) => ({ default: module.ProfilePage })));
const PublicProfilePage = lazy(() => import('../pages/PublicProfilePage').then((module) => ({ default: module.PublicProfilePage })));
const RegisterPage = lazy(() => import('../pages/RegisterPage').then((module) => ({ default: module.RegisterPage })));
const TaskBoardPage = lazy(() => import('../pages/TaskBoardPage').then((module) => ({ default: module.TaskBoardPage })));
const TeamDetailPage = lazy(() => import('../pages/TeamDetailPage').then((module) => ({ default: module.TeamDetailPage })));
const TeamListPage = lazy(() => import('../pages/TeamListPage').then((module) => ({ default: module.TeamListPage })));
const VerifyEmailPage = lazy(() => import('../pages/VerifyEmailPage').then((module) => ({ default: module.VerifyEmailPage })));

function route(element: JSX.Element) {
  return (
    <RouteErrorBoundaryWithLocation>
      <Suspense fallback={<DataState tone="loading">正在加载页面...</DataState>}>{element}</Suspense>
    </RouteErrorBoundaryWithLocation>
  );
}

export const router = createBrowserRouter(
  [
    { path: '/login', element: route(<LoginPage />) },
    { path: '/register', element: route(<RegisterPage />) },
    { path: '/verify-email', element: route(<VerifyEmailPage />) },
  {
    path: '/',
    element: <RequireAuth />,
    children: [
      {
        element: <PageShell />,
        children: [
          { index: true, element: <Navigate to="/teams" replace /> },
          { path: 'profile', element: route(<ProfilePage />) },
          { path: 'users/:identifier', element: route(<PublicProfilePage />) },
          { path: 'teams', element: route(<TeamListPage />) },
          { path: 'teams/new', element: route(<CreateTeamPage />) },
          { path: 'teams/:id', element: route(<TeamDetailPage />) },
          { path: 'tasks', element: route(<TaskBoardPage />) },
          { path: 'chat', element: route(<ChatPage />) },
          { path: 'chat/:teamId', element: route(<ChatPage />) },
          { path: 'notifications', element: route(<NotificationsPage />) },
          { path: 'ai', element: route(<AiWorkbenchPage />) },
          { path: 'admin', element: route(<AdminPage />) },
          { path: '*', element: route(<NotFoundPage />) },
        ],
      },
    ],
  },
    { path: '*', element: route(<NotFoundPage />) },
  ],
  {
    future: {
      v7_startTransition: true,
    },
  },
);
