import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const makeService = (emailVerificationRequired = 'true') => {
    const usersRepo = {
      findByEmail: jest.fn(),
      findByStudentNo: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
    };

    const jwtService = {
      sign: jest.fn().mockReturnValue('mock-access-token'),
    };

    const prisma = {
      emailVerificationToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: {
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const config = {
      get: jest.fn((key: string) => {
        if (key === 'EMAIL_VERIFICATION_REQUIRED') return emailVerificationRequired;
        return undefined;
      }),
    };

    const mailService = {
      sendVerificationEmail: jest.fn(),
    };

    return {
      service: new AuthService(usersRepo as any, jwtService as any, prisma as any, config as any, mailService as any),
      usersRepo,
      jwtService,
    };
  };

  it('should reject login when email verification is required but the account is unverified', async () => {
    const { service, usersRepo } = makeService('true');
    const password = 'Password123';
    usersRepo.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'student@example.edu',
      passwordHash: await bcrypt.hash(password, 10),
      role: 'STUDENT',
      status: 'ACTIVE',
      emailVerifiedAt: null,
    });

    await expect(service.login({ email: 'student@example.edu', password })).rejects.toThrow(UnauthorizedException);
    await expect(service.login({ email: 'student@example.edu', password })).rejects.toThrow('请先验证邮箱后再登录');
  });

  it('should allow login when email verification is not required or account is already verified', async () => {
    const { service, usersRepo, jwtService } = makeService('false');
    const password = 'Password123';
    usersRepo.findByEmail.mockResolvedValue({
      id: 'user-2',
      email: 'student@example.edu',
      passwordHash: await bcrypt.hash(password, 10),
      role: 'STUDENT',
      status: 'ACTIVE',
      emailVerifiedAt: null,
    });

    const result = await service.login({ email: 'student@example.edu', password });

    expect(jwtService.sign).toHaveBeenCalledWith({ sub: 'user-2', email: 'student@example.edu', role: 'STUDENT' });
    expect(result.accessToken).toBe('mock-access-token');
  });
});
