import { ConfigService } from '@nestjs/config';

export function isEmailVerificationRequired(config?: Pick<ConfigService, 'get'>) {
  const raw = config?.get<string>('EMAIL_VERIFICATION_REQUIRED') ?? process.env.EMAIL_VERIFICATION_REQUIRED;
  if (raw === undefined || raw === null || raw.trim() === '') {
    return false;
  }

  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}
