import { Catch, RpcExceptionFilter } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { throwError } from 'rxjs';

@Catch()
export class AllExceptionsFilter implements RpcExceptionFilter {
  catch(exception: any) {
    const status = exception.getStatus?.() || 500;
    const message = exception.message || 'Internal Error';
    return throwError(() => new RpcException({ status, message }));
  }
}
