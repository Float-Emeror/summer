import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskBoardPage } from './TaskBoardPage';

const boardMock = vi.fn();
const updateStatusMock = vi.fn();
const updateTaskMock = vi.fn();
const updateAssigneesMock = vi.fn();

vi.mock('../shared/api/session', () => ({
  isDemoSession: () => false,
}));

vi.mock('../shared/api/teams', () => ({
  teamsApi: {
    mine: vi.fn().mockResolvedValue([
      {
        id: 'team-1',
        title: 'Software Project',
        type: 'COURSE',
        requiredSkills: [],
        maxMembers: 5,
        currentMembers: 3,
        status: 'OPEN',
        myRole: 'OWNER',
      },
    ]),
    detail: vi.fn().mockResolvedValue({
      id: 'team-1',
      title: 'Software Project',
      members: [
        { userId: 'user-1', nickname: 'Alice', role: 'MEMBER' },
        { userId: 'user-2', nickname: 'Bob', role: 'MEMBER' },
      ],
    }),
  },
}));

vi.mock('../shared/api/tasks', () => ({
  tasksApi: {
    board: (...args: unknown[]) => boardMock(...args),
    update: (...args: unknown[]) => updateTaskMock(...args),
    updateAssignees: (...args: unknown[]) => updateAssigneesMock(...args),
    updateStatus: (...args: unknown[]) => updateStatusMock(...args),
    confirm: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
  },
}));

describe('TaskBoardPage', () => {
  beforeEach(() => {
    boardMock.mockResolvedValue([
      { id: 'task-1', teamId: 'team-1', title: 'Review requirements', status: 'TODO', assigneeIds: ['demo-user'], deadline: null },
    ]);
    updateStatusMock.mockReset();
    updateTaskMock.mockReset();
    updateAssigneesMock.mockReset();
  });

  it('renders task board columns and loads tasks for the selected team', async () => {
    render(<TaskBoardPage />);

    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3);
    await waitFor(() => expect(screen.getByText('Review requirements')).toBeInTheDocument());
    expect(boardMock).toHaveBeenCalledWith('team-1');
  });

  it('reloads tasks instead of rolling back from stale optimistic state after a failed move', async () => {
    updateStatusMock.mockRejectedValue(new Error('failed'));
    render(<TaskBoardPage />);

    await waitFor(() => expect(screen.getByText('Review requirements')).toBeInTheDocument());
    const callsBeforeMove = boardMock.mock.calls.length;
    await userEvent.click(screen.getByRole('button', { name: /开始/ }));

    await waitFor(() => expect(updateStatusMock).toHaveBeenCalledWith('task-1', 'DOING'));
    await waitFor(() => expect(boardMock).toHaveBeenCalledTimes(callsBeforeMove + 1));
  });

  it('edits task fields and assignees from the modal', async () => {
    updateTaskMock.mockResolvedValue({
      id: 'task-1',
      teamId: 'team-1',
      title: 'Review API contract',
      status: 'TODO',
      assigneeIds: ['demo-user'],
      deadline: null,
    });
    updateAssigneesMock.mockResolvedValue({
      id: 'task-1',
      teamId: 'team-1',
      title: 'Review API contract',
      status: 'TODO',
      assigneeIds: ['demo-user', 'user-1'],
      deadline: null,
    });
    render(<TaskBoardPage />);

    await waitFor(() => expect(screen.getByText('Review requirements')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /编辑/ }));
    await userEvent.clear(screen.getByLabelText('任务标题'));
    await userEvent.type(screen.getByLabelText('任务标题'), 'Review API contract');
    await userEvent.click(await screen.findByLabelText('Alice'));
    await userEvent.click(screen.getByRole('button', { name: /保存任务/ }));

    await waitFor(() => expect(updateTaskMock).toHaveBeenCalledWith('task-1', expect.objectContaining({ title: 'Review API contract' })));
    expect(updateAssigneesMock).toHaveBeenCalledWith('task-1', ['demo-user', 'user-1']);
  });
});
