import { FormEvent, useState } from 'react';
import { CircleHelp, KeyRound, LogIn, Mail, ShieldCheck } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../shared/auth/AuthProvider';

export function LoginPage() {
  const location = useLocation();
  const registrationState = location.state as { from?: { pathname?: string }; message?: string; email?: string } | null;
  const [email, setEmail] = useState(registrationState?.email ?? '');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState(registrationState?.message ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const from = registrationState?.from?.pathname ?? '/teams';

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    setNotice('');

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch {
      setMessage('账号或密码不正确');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  return (
    <main className="auth-screen">
      <form className="auth-panel login-card" onSubmit={submit}>
        <div className="login-logo" aria-hidden="true">
          <ShieldCheck size={34} />
        </div>

        <div className="login-copy">
          <h1>欢迎使用校园组队平台</h1>
          <p>请输入账号信息以继续访问系统</p>
        </div>

        <div className="login-fields">
          <label className="login-field">
            <span>学校邮箱</span>
            <div className="login-input">
              <Mail size={18} />
              <input
                name="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
          </label>

          <label className="login-field">
            <span>密码</span>
            <div className="login-input">
              <KeyRound size={18} />
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
          </label>
        </div>

        <button className="login-submit" type="submit" disabled={isSubmitting}>
          <LogIn size={18} />
          {isSubmitting ? '验证中...' : '验证并进入'}
        </button>

        <div className="login-links">
          <Link to="/register">
            <CircleHelp size={16} />
            我还没有账号，去创建一个
          </Link>
        </div>

        {notice && <p className="form-message login-success">{notice}</p>}
        {message && <p className="form-message login-error">{message}</p>}
      </form>

      <footer className="login-footer">Campus Team Platform 0.2.0</footer>
    </main>
  );
}
