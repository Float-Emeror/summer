import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, MailCheck } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '../shared/api/auth';
import { ApiError } from '../shared/api/client';
import { useAuth } from '../shared/auth/AuthProvider';

type VerifyState = 'loading' | 'success' | 'error';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = useMemo(() => params.get('token')?.trim() ?? '', [params]);
  const [state, setState] = useState<VerifyState>(token ? 'loading' : 'error');
  const [message, setMessage] = useState(token ? '正在验证邮箱，请稍候。' : '验证链接缺少 token，请重新发送验证邮件。');
  const { isAuthenticated, refreshMe } = useAuth();

  useEffect(() => {
    if (!token) {
      return;
    }

    let alive = true;
    authApi
      .verifyEmail(token)
      .then(async () => {
        if (!alive) return;
        setState('success');
        setMessage('邮箱验证成功，可以继续使用完整功能。');
        if (isAuthenticated) {
          await refreshMe().catch(() => undefined);
        }
      })
      .catch((error) => {
        if (!alive) return;
        setState('error');
        setMessage(error instanceof ApiError ? error.message : '邮箱验证失败，请重新发送验证邮件。');
      });

    return () => {
      alive = false;
    };
  }, [isAuthenticated, refreshMe, token]);

  const Icon = state === 'success' ? CheckCircle2 : state === 'loading' ? Loader2 : AlertTriangle;

  return (
    <main className="auth-screen">
      <section className="auth-panel login-card verify-card">
        <div className="login-logo" aria-hidden="true">
          <MailCheck size={34} />
        </div>
        <div className="login-copy">
          <h1>邮箱验证</h1>
          <p>我们正在确认这封邮箱属于你。</p>
        </div>
        <div className={`verify-status verify-status-${state}`}>
          <Icon size={22} className={state === 'loading' ? 'spin-icon' : undefined} />
          <span>{message}</span>
        </div>
        <div className="verify-actions">
          <Link className="button-link" to={isAuthenticated ? '/teams' : '/login'}>
            {isAuthenticated ? '进入组队大厅' : '返回登录'}
          </Link>
          {state === 'error' && isAuthenticated && (
            <Link className="button-link secondary" to="/teams">
              登录后重发验证邮件
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
