import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { MatchPage } from './MatchPage';

const teamsMock = vi.fn();
const usersMock = vi.fn();

vi.mock('../shared/api/match', () => ({
  matchApi: {
    teams: (...args: unknown[]) => teamsMock(...args),
    users: (...args: unknown[]) => usersMock(...args),
  },
}));

describe('MatchPage', () => {
  beforeEach(() => {
    teamsMock.mockResolvedValue([
      {
        id: 'team-1',
        type: 'COURSE',
        title: '软件工程课程项目组队',
        description: '协作完成项目',
        requiredSkills: ['React'],
        status: 'OPEN',
        maxMembers: 5,
        currentMembers: 3,
        deadline: null,
        bountyAmount: null,
        matchScore: 80,
        matchedSkills: ['React'],
      },
      {
        id: 'team-2',
        type: 'COMPETITION',
        title: '算法训练队',
        description: '备赛协作',
        requiredSkills: ['Python'],
        status: 'OPEN',
        maxMembers: 4,
        currentMembers: 2,
        deadline: null,
        bountyAmount: null,
        matchScore: 60,
        matchedSkills: ['Python'],
      },
      {
        id: 'team-3',
        type: 'VOLUNTEER',
        title: '志愿服务排班队',
        description: '活动协调',
        requiredSkills: ['沟通'],
        status: 'OPEN',
        maxMembers: 6,
        currentMembers: 2,
        deadline: null,
        bountyAmount: null,
        matchScore: 45,
        matchedSkills: ['沟通'],
      },
      {
        id: 'team-4',
        type: 'CLUB',
        title: '社团数据看板',
        description: '可视化协作',
        requiredSkills: ['Excel'],
        status: 'OPEN',
        maxMembers: 5,
        currentMembers: 1,
        deadline: null,
        bountyAmount: null,
        matchScore: 40,
        matchedSkills: ['Excel'],
      },
    ]);
    usersMock.mockResolvedValue([
      { userId: 'u-1', nickname: '接口同学', college: '计算机学院', grade: '2026', skills: ['Prisma'], matchScore: 60, matchedSkills: ['Prisma'] },
      { userId: 'u-2', nickname: '协作同学', college: '软件学院', grade: '2025', skills: ['React'], matchScore: 55, matchedSkills: ['React'] },
      { userId: 'u-3', nickname: '测试同学', college: '信息学院', grade: '2024', skills: ['测试'], matchScore: 50, matchedSkills: ['测试'] },
      { userId: 'u-4', nickname: '文档同学', college: '外语学院', grade: '2026', skills: ['文档'], matchScore: 35, matchedSkills: ['文档'] },
    ]);
  });

  it('renders recommendation overview without the old instant-match action', async () => {
    render(
      <MemoryRouter>
        <MatchPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: '推荐队伍' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /立即匹配/ })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText('当前展示 3 / 4 个候选')).toHaveLength(2);
    });
  });

  it('applies inline skill and bounty filters from the hero controls', async () => {
    render(
      <MemoryRouter>
        <MatchPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(teamsMock).toHaveBeenCalled());
    teamsMock.mockClear();
    usersMock.mockClear();

    await userEvent.type(screen.getByLabelText('技能标签搜索'), 'React, 测试');
    await userEvent.type(screen.getByLabelText('悬赏下限'), '50');
    await userEvent.click(screen.getByRole('button', { name: '搜索匹配结果' }));

    await waitFor(() => {
      expect(teamsMock).toHaveBeenCalledWith(expect.objectContaining({
        minBounty: 50,
        skills: ['React', '测试'],
      }));
      expect(usersMock).toHaveBeenCalledWith({ skills: ['React', '测试'], keyword: undefined });
    });
  });

  it('applies type tabs only to recommended teams', async () => {
    render(
      <MemoryRouter>
        <MatchPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(teamsMock).toHaveBeenCalled());
    teamsMock.mockClear();
    usersMock.mockClear();

    await userEvent.click(screen.getByRole('tab', { name: '竞赛组队' }));

    await waitFor(() => {
      expect(teamsMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'COMPETITION' }));
      expect(usersMock).toHaveBeenCalledWith(expect.not.objectContaining({ type: 'COMPETITION' }));
    });
  });

  it('opens the teammate lookup modal and applies keyword search', async () => {
    render(
      <MemoryRouter>
        <MatchPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(teamsMock).toHaveBeenCalled());
    teamsMock.mockClear();
    usersMock.mockClear();

    await userEvent.click(screen.getByRole('button', { name: '按昵称或学号找队友' }));
    expect(screen.getByRole('dialog', { name: '查找队友' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('队友昵称或学号'), '测试同学');
    await userEvent.click(within(screen.getByRole('dialog', { name: '查找队友' })).getByRole('button', { name: '搜索' }));

    await waitFor(() => {
      expect(usersMock).toHaveBeenCalledWith({ skills: [], keyword: '测试同学' });
    });
  });
});
