import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err, user, _info) {
    // 统一接管未登录或者 Token 失效的错误响应格式
    if (err || !user) {
      throw err || new UnauthorizedException('尚未登录或 Token 已过期，请重新登录');
    }
    return user;
  }
}
