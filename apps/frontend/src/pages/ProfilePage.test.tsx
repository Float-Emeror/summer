import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePage } from './ProfilePage';

const meMock = vi.fn();
const updateProfileMock = vi.fn();
const updateSkillsMock = vi.fn();
const updateAvailabilityMock = vi.fn();

vi.mock('../shared/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'u-1', email: 'testprofile@example.edu' } }),
}));

vi.mock('../shared/api/users', () => ({
  usersApi: {
    me: (...args: unknown[]) => meMock(...args),
    updateProfile: (...args: unknown[]) => updateProfileMock(...args),
    updateSkills: (...args: unknown[]) => updateSkillsMock(...args),
    updateAvailability: (...args: unknown[]) => updateAvailabilityMock(...args),
  },
}));

function mockProfile(availability = ['周五 20:00-21:30']) {
  meMock.mockResolvedValue({
    nickname: 'TestProfile',
    college: '计算机学院',
    grade: '2026级',
    email: 'testprofile@example.edu',
    studentNo: '20260001',
    skills: ['React'],
    availability,
    completeness: 90,
  });
}

function mockTrackGeometry(track: HTMLElement) {
  vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 96,
    bottom: 240,
    width: 96,
    height: 240,
    toJSON: () => ({}),
  });
}

function minuteClientY(minutes: number) {
  return (minutes / 1440) * 240;
}

function renderProfilePage() {
  return render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>,
  );
}

async function expectSlotInputs(day: string, startTime: string, endTime: string) {
  const label = `${day} ${startTime}-${endTime}`;

  await waitFor(() => {
    expect(screen.getByLabelText(`${label} 开始时间`)).toHaveValue(startTime);
    expect(screen.getByLabelText(`${label} 结束时间`)).toHaveValue(endTime);
  });
}

describe('ProfilePage availability slider', () => {
  beforeEach(() => {
    localStorage.setItem('accessToken', 'real-token');
    meMock.mockReset();
    updateProfileMock.mockResolvedValue({});
    updateSkillsMock.mockResolvedValue({});
    updateAvailabilityMock.mockResolvedValue({});
    mockProfile();
  });

  it('keeps half-hour availability without restoring the removed total-hours summary', async () => {
    renderProfilePage();

    await expectSlotInputs('周五', '20:00', '21:30');
    expect(screen.queryByText('1.5')).not.toBeInTheDocument();
    expect(screen.queryByText('小时')).not.toBeInTheDocument();
  });

  it('dragging a day slider creates a draft slot that is saved before submit', async () => {
    mockProfile([]);
    renderProfilePage();

    await screen.findByText(/拖动左侧时间滑动条添加空闲时间/);
    const track = screen.getByRole('slider', { name: '周一 时间滑动条' });
    mockTrackGeometry(track);

    await act(async () => {
      fireEvent.mouseDown(track, { clientY: minuteClientY(19 * 60) });
      fireEvent.mouseMove(track, { clientY: minuteClientY(21 * 60) });
      fireEvent.mouseUp(track, { clientY: minuteClientY(21 * 60) });
    });

    await expectSlotInputs('周一', '19:00', '21:00');

    fireEvent.click(screen.getByRole('button', { name: '保存时间' }));
    fireEvent.click(screen.getByRole('button', { name: '保存资料' }));

    await waitFor(() =>
      expect(updateAvailabilityMock).toHaveBeenCalledWith([{ weekday: 1, startTime: '19:00', endTime: '21:00' }]),
    );
  });

  it('merges overlapping dragged ranges automatically', async () => {
    mockProfile(['周一 19:00-20:00']);
    renderProfilePage();

    const track = await screen.findByRole('slider', { name: '周一 时间滑动条' });
    mockTrackGeometry(track);

    await act(async () => {
      fireEvent.mouseDown(track, { clientY: minuteClientY(19 * 60 + 30) });
      fireEvent.mouseMove(track, { clientY: minuteClientY(21 * 60) });
      fireEvent.mouseUp(track, { clientY: minuteClientY(21 * 60) });
    });

    await expectSlotInputs('周一', '19:00', '21:00');
    expect(screen.queryByLabelText('周一 19:00-20:00 开始时间')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('周一 19:30-21:00 开始时间')).not.toBeInTheDocument();
  });

  it('deletes a draft summary row before saving availability', async () => {
    mockProfile(['周一 19:00-21:00']);
    renderProfilePage();

    const startInput = await screen.findByLabelText('周一 19:00-21:00 开始时间');
    const group = startInput.closest('.availability-summary-row');
    expect(group).not.toBeNull();
    fireEvent.click(within(group as HTMLElement).getByRole('button', { name: '删除 周一 19:00-21:00' }));

    await waitFor(() => expect(screen.queryByLabelText('周一 19:00-21:00 开始时间')).not.toBeInTheDocument());
  });
});
