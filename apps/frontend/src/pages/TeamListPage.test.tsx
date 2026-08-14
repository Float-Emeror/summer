import type { ComponentType } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { teamTypeLabels } from '../shared/constants/team';
import type { Team } from '../shared/types/domain';
import { TeamListPage } from './TeamListPage';

const teamsApiMock = vi.hoisted(() => ({
  mine: vi.fn(),
  joinByCode: vi.fn(),
}));

vi.mock('../shared/api/teams', () => ({
  teamsApi: teamsApiMock,
}));

vi.mock('masonic', () => ({
  Masonry: ({ items, render: Render }: { items: unknown[]; render: ComponentType<{ data: unknown; index: number; width: number }> }) => (
    <div className="market-grid">
      {items.map((item, index) => (
        <Render key={(item as { id?: string }).id ?? index} data={item} index={index} width={326} />
      ))}
    </div>
  ),
}));

const teamFixtures: Team[] = [
  {
    id: 'team-course',
    title: 'Course Project Team',
    type: 'COURSE',
    description: 'Build the campus team platform with frontend and backend roles.',
    requiredSkills: ['React', 'NestJS'],
    status: 'OPEN',
    maxMembers: 5,
    currentMembers: 3,
    ownerNickname: 'FrontendLab',
  },
  {
    id: 'team-competition',
    title: 'Modeling Contest Sprint',
    type: 'COMPETITION',
    description: 'Prepare modeling, coding and paper writing for the contest.',
    requiredSkills: ['Python', 'Modeling'],
    status: 'OPEN',
    maxMembers: 4,
    currentMembers: 2,
    ownerNickname: 'ModelingLab',
  },
];

describe('TeamListPage', () => {
  beforeEach(() => {
    teamsApiMock.mine.mockResolvedValue(teamFixtures);
    teamsApiMock.joinByCode.mockResolvedValue({ id: 'team-course' });
  });

  it('renders the my-team market list', async () => {
    render(
      <MemoryRouter>
        <TeamListPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Course Project Team')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '管理你创建或加入的队伍' })).toBeInTheDocument();
    expect(screen.getByLabelText('搜索我的队伍')).toBeInTheDocument();
  });

  it('filters teams by the search input', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TeamListPage />
      </MemoryRouter>,
    );

    const searchInput = await screen.findByLabelText('搜索我的队伍');
    await user.type(searchInput, 'Contest');

    await waitFor(() => {
      expect(screen.getByText('Modeling Contest Sprint')).toBeInTheDocument();
      expect(screen.queryByText('Course Project Team')).not.toBeInTheDocument();
    }, { timeout: 1200 });
  });
});
