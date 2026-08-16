import { AppealStatus } from '@prisma/client';
import { AdminRepository } from './admin.repository';

describe('AdminRepository', () => {
  it('should respect the appeal decision when resolving an appeal', async () => {
    const tx = {
      appeal: {
        update: jest.fn().mockResolvedValue({ id: 'appeal-1', status: AppealStatus.REJECTED }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    };

    const prisma = {
      $transaction: jest.fn(async (callback) => callback(tx)),
    };

    const repo = new AdminRepository(prisma as any);

    await repo.resolveAppeal('admin-1', 'appeal-1', 'REJECTED');

    expect(tx.appeal.update).toHaveBeenCalledWith({
      where: { id: 'appeal-1' },
      data: { status: AppealStatus.REJECTED, resolvedAt: expect.any(Date) },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'admin-1',
        action: 'APPEAL_RESOLVED',
        target: 'appeal:appeal-1',
        metadata: { decision: 'REJECTED' },
      },
    });
  });
});
