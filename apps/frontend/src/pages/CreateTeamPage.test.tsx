import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CreateTeamPage } from './CreateTeamPage';

describe('CreateTeamPage', () => {
  it('renders create team form', () => {
    render(
      <MemoryRouter>
        <CreateTeamPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: '创建一个清晰的招募卡片' })).toBeInTheDocument();
    expect(screen.getByLabelText('标题')).toBeInTheDocument();
    expect(screen.getByLabelText('人数上限')).toBeInTheDocument();
    expect(screen.getByText('实时预览')).toBeInTheDocument();
    expect(document.querySelector('a[href="/teams/team-preview"]')).not.toBeInTheDocument();
  });
});
