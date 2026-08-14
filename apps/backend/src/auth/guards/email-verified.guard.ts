import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { isEmailVerificationRequired } from '../email-verification.config';

@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!isEmailVerificationRequired()) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: { emailVerified?: boolean } }>();
    if (!request.user?.emailVerified) {
      throw new ForbiddenException({ code: 'EMAIL_VERIFICATION_REQUIRED', message: '请先验证邮箱后再进行该操作。' });
    }

    return true;
  }
}
