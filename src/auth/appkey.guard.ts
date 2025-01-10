import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class AppKeyGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const appKey = request.headers['x-app-key'];
    if (appKey && appKey === process.env.APP_SECRET_KEY) {
      return true;
    }
    return false;
  }
}
