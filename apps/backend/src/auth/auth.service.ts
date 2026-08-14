import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { UsersRepository } from '../users/users.repository';
import { PrismaService } from '../prisma/prisma.service';
import { AppMailService, MailDeliveryException } from '../mail/mail.service';
import { LoginDto, RegisterDto, VerifyEmailDto } from './dto/auth.dto';
import { isEmailVerificationRequired } from './email-verification.config';

type AuthUser = {
  id: string;
  email: string;
  role: string;
  status?: string;
  emailVerifiedAt?: Date | null;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersRepo: UsersRepository,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private config: ConfigService,
    private mailService: AppMailService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const studentNo = dto.studentNo.trim();
    const existingEmail = await this.usersRepo.findByEmail(email);
    if (existingEmail) {
      throw new ConflictException('该邮箱已被注册');
    }

    const existingStudentNo = await this.usersRepo.findByStudentNo(studentNo);
    if (existingStudentNo) {
      throw new ConflictException('该学号已被注册');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const nickname = dto.nickname?.trim() || `同学_${studentNo.slice(-4)}`;

    const user = await this.usersRepo.create({
      email,
      studentNo,
      passwordHash,
      status: 'ACTIVE',
      profile: {
        create: { nickname },
      },
    });

    const authResponse = this.generateToken(user);
    const verification = this.isEmailVerificationRequired()
      ? await this.createAndSendVerification(user.id, user.email).catch((error) => {
          const message = this.extractMailErrorMessage(error);
          this.logger.warn(`Register created unverified account ${user.id}, but email delivery failed: ${message}`);
          return {
            verificationEmailSent: false,
            emailVerificationRequired: true,
            verificationEmailError: message,
          };
        })
      : { verificationEmailSent: false, emailVerificationRequired: false };

    return {
      ...authResponse,
      ...verification,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersRepo.findByEmail(dto.email.trim().toLowerCase());
    if (!user) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    if ((user as AuthUser).status === 'DISABLED') {
      throw new UnauthorizedException('账号已被禁用，请联系管理员');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    return this.generateToken(user);
  }

  async getMe(userId: string) {
    const user = await this.usersRepo.findById(userId);
    if (!user) {
      throw new UnauthorizedException('当前登录账号不存在，请重新登录。');
    }
    return {
      user: this.toAuthUser(user),
    };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const tokenHash = this.hashToken(dto.token);
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record) {
      throw new BadRequestException({ code: 'EMAIL_TOKEN_INVALID', message: '验证链接无效，请重新发送验证邮件。' });
    }
    if (record.usedAt) {
      throw new BadRequestException({ code: 'EMAIL_TOKEN_USED', message: '验证链接已使用，请直接登录。' });
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException({ code: 'EMAIL_TOKEN_EXPIRED', message: '验证链接已过期，请重新发送验证邮件。' });
    }

    const emailVerifiedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: emailVerifiedAt },
      }),
    ]);

    return {
      verified: true,
      emailVerifiedAt,
    };
  }

  async resendVerificationEmail(userId: string) {
    const user = await this.usersRepo.findById(userId);
    if (!user) {
      throw new UnauthorizedException('当前登录账号不存在，请重新登录。');
    }
    if (!this.isEmailVerificationRequired()) {
      return { alreadyVerified: true, emailVerificationRequired: false };
    }
    if (user.emailVerifiedAt) {
      return { alreadyVerified: true };
    }

    return this.createAndSendVerification(user.id, user.email);
  }

  private generateToken(user: AuthUser) {
    const role = user.role || 'STUDENT';
    const payload = { sub: user.id, email: user.email, role };
    const accessToken = this.jwtService.sign(payload);

    return {
      user: this.toAuthUser(user),
      accessToken,
    };
  }

  private toAuthUser(user: AuthUser) {
    const role = user.role || 'STUDENT';
    return {
      id: user.id,
      email: user.email,
      role,
      emailVerified: !this.isEmailVerificationRequired() || Boolean(user.emailVerifiedAt),
      emailVerifiedAt: user.emailVerifiedAt ?? null,
    };
  }

  private isEmailVerificationRequired() {
    return isEmailVerificationRequired(this.config);
  }

  private async createAndSendVerification(userId: string, email: string) {
    const { token, tokenHash } = this.createToken();
    const expiresAt = new Date(Date.now() + this.tokenTtlMinutes() * 60 * 1000);
    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    const verifyUrl = `${this.frontendUrl()}/verify-email?token=${encodeURIComponent(token)}`;
    await this.mailService.sendVerificationEmail(email, verifyUrl, expiresAt);

    return {
      verificationEmailSent: true,
      emailVerificationRequired: true,
      expiresAt,
    };
  }

  private createToken() {
    const token = randomBytes(32).toString('base64url');
    return { token, tokenHash: this.hashToken(token) };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private tokenTtlMinutes() {
    const ttl = Number(this.config.get('EMAIL_VERIFY_TOKEN_TTL_MINUTES') ?? 30);
    return Number.isFinite(ttl) && ttl > 0 ? ttl : 30;
  }

  private frontendUrl() {
    return (this.config.get<string>('APP_FRONTEND_URL') ?? this.config.get<string>('CORS_ORIGIN') ?? 'http://localhost:5173').replace(/\/$/, '');
  }

  private extractMailErrorMessage(error: unknown) {
    if (error instanceof MailDeliveryException) {
      const response = error.getResponse() as { message?: string; code?: string };
      return response.message ?? error.message;
    }
    return error instanceof Error ? error.message : String(error);
  }
}
