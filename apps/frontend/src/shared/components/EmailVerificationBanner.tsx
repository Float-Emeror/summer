import { useState } from 'react';
import { MailCheck, RefreshCw, ShieldAlert, X } from 'lucide-react';
import { ApiError } from '../api/client';
import { authApi } from '../api/auth';
import { useAuth } from '../auth/AuthProvider';

export function EmailVerificationBanner() {
  const { user, refreshMe } = useAuth();
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState<'resend' | 'refresh' | ''>('');
  const [message, setMessage] = useState('');

  if (!user || user.emailVerified || hidden) {
    return null;
  }

  async function resend() {
    setBusy('resend');
    setMessage('');
    try {
      const result = await authApi.resendVerificationEmail();
      if (result.alreadyVerified) {
        await refreshMe();
        setMessage('邮箱已完成验证，状态已刷新。');
      } else {
        setMessage(result.expiresAt ? '验证邮件已重新发送，请检查邮箱。' : '验证邮件已重新发送。');
      }
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : '验证邮件发送失败，请稍后重试。');
    } finally {
      setBusy('');
    }
  }

  async function refresh() {
    setBusy('refresh');
    setMessage('');
    try {
      await refreshMe();
      setMessage('邮箱验证状态已刷新。');
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : '状态刷新失败，请稍后重试。');
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="email-verify-banner email-floating-notice" aria-live="polite">
      <div className="email-verify-icon email-floating-notice__icon">
        <ShieldAlert size={20} />
      </div>
      <div className="email-verify-copy">
        <strong className="email-floating-notice__title">邮箱尚未验证</strong>
        <span className="email-floating-notice__desc">验证 {user.email} 后才能发布组队、通过队伍码入队、管理任务和提交评价。</span>
        {message && <small>{message}</small>}
      </div>
      <div className="email-verify-actions email-floating-notice__actions">
        <button type="button" className="email-verify-secondary" onClick={refresh} disabled={Boolean(busy)}>
          <RefreshCw size={16} className={busy === 'refresh' ? 'spin-icon' : undefined} />
          刷新状态
        </button>
        <button type="button" onClick={resend} disabled={Boolean(busy)}>
          <MailCheck size={16} />
          {busy === 'resend' ? '发送中' : '重发邮件'}
        </button>
        <button type="button" className="email-verify-close" onClick={() => setHidden(true)} aria-label="暂时隐藏邮箱验证提示">
          <X size={16} />
        </button>
      </div>
    </section>
  );
}
