import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ApplicationsService } from './applications.service';

describe('ApplicationsService', () => {
  const buildService = () => {
    const appsRepo = {
      getTeamBasicInfo: jest.fn(),
      checkExistingApplication: jest.fn(),
      createApplication: jest.fn(),
      findApplicationsByTeam: jest.fn(),
      findApplicationById: jest.fn(),
      reviewApplication: jest.fn(),
    };

    const creditService = {
      getUserTotalCredit: jest.fn().mockResolvedValue({ totalScore: 80 }),
    };

    const eventEmitter = {
      emit: jest.fn(),
    };

    return {
      service: new ApplicationsService(appsRepo as any, creditService as any, eventEmitter as any),
      appsRepo,
      creditService,
      eventEmitter,
    };
  };

  it('should reject applying when the team is full', async () => {
    const { service, appsRepo } = buildService();
    appsRepo.getTeamBasicInfo.mockResolvedValue({
      id: 'team-1',
      ownerId: 'owner-1',
      maxMembers: 2,
      members: [{ userId: 'u1' }, { userId: 'u2' }],
    });
    appsRepo.checkExistingApplication.mockResolvedValue(null);

    await expect(service.applyToTeam('applicant-1', 'team-1', '想加入')).rejects.toThrow(BadRequestException);
    await expect(service.applyToTeam('applicant-1', 'team-1', '想加入')).rejects.toThrow('该队伍人数已满');
  });

  it('should reject a review when the caller is not the owner', async () => {
    const { service, appsRepo } = buildService();
    appsRepo.findApplicationById.mockResolvedValue({
      id: 'app-1',
      status: 'PENDING',
      team: { ownerId: 'owner-1' },
    });

    await expect(service.reviewApplication('other-user', 'app-1', 'APPROVED' as any)).rejects.toThrow(UnauthorizedException);
  });

  it('should reject approving when the team is already full', async () => {
    const { service, appsRepo } = buildService();
    appsRepo.findApplicationById.mockResolvedValue({
      id: 'app-1',
      status: 'PENDING',
      applicantId: 'applicant-1',
      team: { ownerId: 'owner-1', maxMembers: 2, members: [{ userId: 'u1' }, { userId: 'u2' }] },
    });

    await expect(service.reviewApplication('owner-1', 'app-1', 'APPROVED' as any)).rejects.toThrow(BadRequestException);
    await expect(service.reviewApplication('owner-1', 'app-1', 'APPROVED' as any)).rejects.toThrow('该队伍人数已满');
  });

  it('should throw not found when an application does not exist', async () => {
    const { service, appsRepo } = buildService();
    appsRepo.findApplicationById.mockResolvedValue(null);

    await expect(service.reviewApplication('owner-1', 'missing-app', 'APPROVED' as any)).rejects.toThrow(NotFoundException);
  });
});
