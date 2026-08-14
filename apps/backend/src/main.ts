import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const prefix = config.get<string>('API_GLOBAL_PREFIX', 'api');
  const corsOrigin = config.get<string>('CORS_ORIGIN');

  app.setGlobalPrefix(prefix);
  const defaultCorsOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173'];
  app.enableCors({
    origin: corsOrigin ? [...corsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean), ...defaultCorsOrigins] : defaultCorsOrigins,
    credentials: true,
  });
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalInterceptors(new TransformInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('校园组队报名平台 API')
    .setDescription('Phase 2 modular NestJS API skeleton.')
    .setVersion('0.2.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${prefix}/docs`, app, document);

  await app.listen(config.get<number>('API_PORT', 3000));
}

void bootstrap();
