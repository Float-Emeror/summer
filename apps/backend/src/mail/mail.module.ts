import { MailerModule } from '@nestjs-modules/mailer';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppMailService } from './mail.service';

@Module({
  imports: [
    ConfigModule,
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const port = Number(config.get('MAIL_PORT') ?? 0);
        const user = config.get<string>('MAIL_USER');
        return {
          transport: {
            host: config.get<string>('MAIL_HOST'),
            port,
            secure: port === 465,
            auth: {
              user,
              pass: config.get<string>('MAIL_PASS'),
            },
          },
          defaults: {
            from: config.get<string>('MAIL_FROM') || (user ? `"校园组队平台" <${user}>` : undefined),
          },
        };
      },
    }),
  ],
  providers: [AppMailService],
  exports: [AppMailService],
})
export class AppMailModule {}
