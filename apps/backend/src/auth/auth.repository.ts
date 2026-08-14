import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthRepository {
  constructor(private prisma: PrismaService) {}

  // 预留位置：未来如果要将 VerifyEmailDto 中的验证码存入数据库，
  // 或者需要管理 RefreshToken (刷新令牌)，相关的数据库操作都写在这里。
  // 目前基础的登录注册，直接调用 UsersRepository 即可。
}