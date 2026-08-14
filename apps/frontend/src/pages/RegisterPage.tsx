import { FormEvent, useState } from 'react';
import { GraduationCap, Mail, UserPlus, KeyRound, ShieldCheck } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../shared/auth/AuthProvider';
import { ApiError } from '../shared/api/client';

export function RegisterPage() {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isAuthenticated, register } = useAuth();
  const navigate = useNavigate();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setIsSubmitting(true);
    setMessage('');

    try {
      const email = String(form.get('email'));
      const result = await register(String(form.get('studentNo')), email, String(form.get('password')));
      const message = result.verificationEmailSent
        ? '注册成功，验证邮件已发送，请登录后查看邮箱完成验证。'
        : `注册成功，但验证邮件未发送：${result.verificationEmailError ?? '请登录后重发验证邮件。'}`;
      navigate('/login', { replace: true, state: { message, email } });
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : '注册失败，请检查后端服务是否已启动。');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isAuthenticated) {
    return <Navigate to="/teams" replace />;
  }

  return (
    <main className="auth-screen">
      <form className="auth-panel login-card" onSubmit={submit}>
        <div className="login-logo" aria-hidden="true">
          <ShieldCheck size={34} />
        </div>
        <div className="login-copy">
          <h1>创建校园组队账号</h1>
          <p>填写基本信息，开启你的协作空间</p>
        </div>
        <div className="login-fields">
          <label className="login-field">
            <span>学号</span>
            <div className="login-input">
              <GraduationCap size={18} />
              <input name="studentNo" placeholder="例如：20261234" required />
            </div>
          </label>
          <label className="login-field">
            <span>学校邮箱</span>
            <div className="login-input">
              <Mail size={18} />
              <input name="email" type="email" placeholder="name@example.edu" required />
            </div>
          </label>
          <label className="login-field">
            <span>密码</span>
            <div className="login-input">
              <KeyRound size={18} />
              <input name="password" type="password" minLength={8} placeholder="至少 8 位" required />
            </div>
          </label>
        </div>
        <button className="login-submit" type="submit" disabled={isSubmitting}>
          <UserPlus size={18} />
          {isSubmitting ? '注册中...' : '创建账号'}
        </button>
        <div className="login-links">
          <Link to="/login">返回登录</Link>
        </div>
        {message && <p className="form-message login-error">{message}</p>}
      </form>
    </main>
  );
}
