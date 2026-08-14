import { MatchService } from './match.service';

describe('MatchService', () => {
  const buildService = () => {
    const prisma = {
      user: { findUnique: jest.fn() },
      team: { findMany: jest.fn() },
    };

    return {
      service: new MatchService(prisma as any),
      prisma,
    };
  };

  it('should return a default ranked list when no explicit skill filter is provided', async () => {
    const { service, prisma } = buildService();
    prisma.user.findUnique.mockResolvedValue({
      profile: {
        skills: [{ name: 'React' }, { name: 'NestJS' }],
      },
    });

    prisma.team.findMany.mockResolvedValue([
      {
        id: 'team-2',
        ownerId: 'owner-2',
        owner: { profile: { nickname: 'B' } },
        type: 'COURSE',
        title: 'B team',
        description: 'desc',
        maxMembers: 5,
        status: 'OPEN',
        requiredSkills: [{ name: 'React' }],
        members: [{ userId: 'u1' }],
        _count: { members: 1 },
        deadline: null,
        bountyAmount: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'team-1',
        ownerId: 'owner-1',
        owner: { profile: { nickname: 'A' } },
        type: 'COURSE',
        title: 'A team',
        description: 'desc',
        maxMembers: 5,
        status: 'OPEN',
        requiredSkills: [{ name: 'Python' }],
        members: [{ userId: 'u1' }],
        _count: { members: 1 },
        deadline: null,
        bountyAmount: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await service.recommendTeamsForUser('user-1', { skills: '' });

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('team-2');
    expect(result[0].matchScore).toBeGreaterThan(result[1].matchScore);
  });

  it('should fall back to user skills when no explicit skills are passed', async () => {
    const { service, prisma } = buildService();
    prisma.user.findUnique.mockResolvedValue({
      profile: {
        skills: [{ name: 'React' }, { name: 'NestJS' }],
      },
    });

    prisma.team.findMany.mockResolvedValue([
      {
        id: 'team-1',
        ownerId: 'owner-1',
        owner: { profile: { nickname: 'A' } },
        type: 'COURSE',
        title: 'A team',
        description: 'desc',
        maxMembers: 5,
        status: 'OPEN',
        requiredSkills: [{ name: 'React' }],
        members: [{ userId: 'u1' }],
        _count: { members: 1 },
        deadline: null,
        bountyAmount: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await service.recommendTeamsForUser('user-1');

    expect(result).toHaveLength(1);
    expect(result[0].matchedSkills).toContain('React');
  });
});
