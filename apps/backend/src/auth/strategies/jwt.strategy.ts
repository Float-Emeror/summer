import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { isEmailVerificationRequired } from '../email-verification.config';

interface JwtPayload {
  sub: string;
  email: string;
  role?: string; 
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET must be configured before starting the API.');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { emailVerifiedAt: true, status: true },
    });

    return { 
      userId: payload.sub, 
      email: payload.email,
      role: payload.role || 'STUDENT',
      status: user?.status,
      emailVerified: !isEmailVerificationRequired(this.configService) || Boolean(user?.emailVerifiedAt),
    };
  }
}
