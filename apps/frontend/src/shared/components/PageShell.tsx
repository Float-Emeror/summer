import { Bell, Bot, ClipboardList, LogOut, Shield, UserRound, UsersRound, MessageSquare } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { EmailVerificationBanner } from './EmailVerificationBanner';

const links = [
  { to: '/teams', label: '队伍', icon: UsersRound },
  { to: '/profile', label: '资料', icon: UserRound },
  { to: '/tasks', label: '任务', icon: ClipboardList },
  { to: '/chat', label: '团队聊天', icon: MessageSquare },
  { to: '/notifications', label: '通知', icon: Bell },
  { to: '/ai', label: 'AI', icon: Bot },
  { to: '/admin', label: '管理', icon: Shield },
];

export function PageShell() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="layout app-shell">
      <aside className="sidebar">
        <div className="brand sidebar-logo">代码解析器</div>
        <nav>
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'nav-link sidebar-nav-item active' : 'nav-link sidebar-nav-item')}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-account sidebar-footer">
          <div>
            <span>{user?.email}</span>
            <small>{user?.role}</small>
          </div>
          <button type="button" className="icon-button" onClick={handleLogout} aria-label="退出登录" title="退出登录">
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <main className="content app-main">
        <EmailVerificationBanner />
        <Outlet />
      </main>
    </div>
  );
}
