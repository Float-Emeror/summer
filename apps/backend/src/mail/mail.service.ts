import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type MailFailureCode = 'MAIL_CONFIG_MISSING' | 'MAIL_AUTH_FAILED' | 'MAIL_SEND_FAILED';

export class MailDeliveryException extends ServiceUnavailableException {
  constructor(
    public readonly code: MailFailureCode,
    message: string,
  ) {
    super({ code, message });
  }
}

@Injectable()
export class AppMailService {
  private readonly logger = new Logger(AppMailService.name);

  constructor(
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
  ) {}

  async sendVerificationEmail(to: string, verifyUrl: string, expiresAt: Date) {
    this.assertMailConfig(to);

    try {
      await this.mailer.sendMail({
        to,
        subject: '校园组队平台邮箱验证',
        html: this.renderVerificationEmail(verifyUrl, expiresAt),
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const code = this.isAuthError(err) ? 'MAIL_AUTH_FAILED' : 'MAIL_SEND_FAILED';
      this.logger.error(`Failed to send verification email to ${to}: ${err.message}`, err.stack);
      throw new MailDeliveryException(code, code === 'MAIL_AUTH_FAILED' ? '邮箱服务认证失败，请检查 SMTP 授权码。' : '验证邮件发送失败，请稍后重试。');
    }
  }

  async sendSystemEmail(to: string, subject: string, html: string) {
    this.assertMailConfig(to);

    try {
      await this.mailer.sendMail({ to, subject, html });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const code = this.isAuthError(err) ? 'MAIL_AUTH_FAILED' : 'MAIL_SEND_FAILED';
      this.logger.error(`Failed to send system email to ${to}: ${err.message}`, err.stack);
      throw new MailDeliveryException(code, code === 'MAIL_AUTH_FAILED' ? '邮箱服务认证失败，请检查 SMTP 授权码。' : '邮件发送失败，请稍后重试。');
    }
  }

  private assertMailConfig(to: string) {
    const host = this.config.get<string>('MAIL_HOST')?.trim();
    const user = this.config.get<string>('MAIL_USER')?.trim();
    const pass = this.config.get<string>('MAIL_PASS')?.trim();
    const missing =
      !host ||
      !user ||
      !pass ||
      user.includes('你的邮箱') ||
      pass.includes('授权码') ||
      host.includes('example');

    if (missing) {
      this.logger.warn(`Verification email skipped for ${to}: SMTP config is incomplete.`);
      throw new MailDeliveryException('MAIL_CONFIG_MISSING', '邮箱服务未配置，请配置 SMTP 后重发验证邮件。');
    }
  }

  private isAuthError(error: Error) {
    const text = `${error.name} ${error.message}`.toLowerCase();
    return text.includes('auth') || text.includes('login') || text.includes('credential') || text.includes('535');
  }

  private renderVerificationEmail(verifyUrl: string, expiresAt: Date) {
    const expiresText = expiresAt.toLocaleString('zh-CN', { hour12: false });
    return `
      <div style="font-family: Arial, sans-serif; padding: 24px; background: #f7f2ff;">
        <div style="max-width: 560px; margin: 0 auto; padding: 28px; background: #ffffff; border-radius: 18px; border: 1px solid #ddd0ff;">
          <h2 style="margin: 0 0 12px; color: #2b194f;">验证你的校园组队平台邮箱</h2>
          <p style="color: #6b6380; line-height: 1.7;">点击下面的按钮完成邮箱验证。验证后即可发布组队、申请入队、管理任务和提交评价。</p>
          <p style="margin: 24px 0;">
            <a href="${verifyUrl}" style="display: inline-block; padding: 12px 20px; border-radius: 12px; background: #7c3aed; color: #ffffff; text-decoration: none; font-weight: 700;">完成邮箱验证</a>
          </p>
          <p style="color: #8a809e; font-size: 13px;">链接有效期至 ${expiresText}。如果按钮无法打开，请复制下面链接到浏览器：</p>
          <p style="word-break: break-all; color: #6d28d9; font-size: 13px;">${verifyUrl}</p>
        </div>
      </div>
    `;
  }
}
