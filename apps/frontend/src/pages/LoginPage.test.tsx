import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../shared/auth/AuthProvider';
import { LoginPage } from './LoginPage';

describe('LoginPage', () => {
  it('renders login form fields', () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(screen.getByRole('heading', { name: '欢迎使用校园组队平台' })).toBeInTheDocument();
    expect(screen.getByLabelText('学校邮箱')).toBeInTheDocument();
    expect(screen.getByLabelText('密码')).toBeInTheDocument();
  });

  it('does not prefill the development test account', () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(screen.getByLabelText('学校邮箱')).toHaveValue('');
    expect(screen.getByLabelText('密码')).toHaveValue('');
    expect(screen.queryByText(/testprofile/i)).not.toBeInTheDocument();
  });
});
