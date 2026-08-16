import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const buildService = () => {
    const notifRepo = {
      create: jest.fn(),
      findUnread: jest.fn(),
      findAll: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
    };

    const notifGateway = {
      pushToUser: jest.fn(),
    };

    const prisma = {
      user: {
        findUnique: jest.fn(),
      },
    };

    const config = {
      get: jest.fn(),
    };

    const mailService = {
      sendSystemEmail: jest.fn(),
    };

    return {
      service: new NotificationsService(
        notifRepo as any,
        notifGateway as any,
        prisma as any,
        config as any,
        mailService as any,
      ),
      notifRepo,
      notifGateway,
      prisma,
      config,
      mailService,
    };
  };

  it('should ignore notifications without a target user and log the issue', async () => {
    const { service, notifRepo, notifGateway, prisma, config, mailService } = buildService();
    const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
    config.get.mockReturnValue('smtp-user');

    await expect(
      service.handleNotificationEvent({ userId: '', type: 'TASK_ASSIGNED', title: '测试', content: '内容' } as any),
    ).resolves.toBeUndefined();

    expect(notifRepo.create).not.toHaveBeenCalled();
    expect(notifGateway.pushToUser).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(mailService.sendSystemEmail).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith('通知事件缺少目标用户，已忽略：TASK_ASSIGNED');
  });
});
