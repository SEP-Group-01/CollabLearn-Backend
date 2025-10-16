import { Catch, RpcExceptionFilter, BadRequestException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { throwError } from 'rxjs';

@Catch()
export class AllExceptionsFilter implements RpcExceptionFilter {
  catch(exception: any) {
    console.error('🔥 [AllExceptionsFilter] Caught exception:', exception);
    console.error('🔍 [AllExceptionsFilter] Exception type:', exception.constructor.name);
    console.error('🔍 [AllExceptionsFilter] Exception details:', {
      message: exception.message,
      stack: exception.stack?.split('\n').slice(0, 5),
      response: exception.response,
      status: exception.status,
    });

    let status = 500;
    let message = 'Internal Error';

    if (exception instanceof BadRequestException) {
      status = 400;
      message = exception.message;
      console.error('📋 [AllExceptionsFilter] Validation error details:', exception.getResponse());
    } else if (exception instanceof RpcException) {
      const errorObject = exception.getError();
      if (typeof errorObject === 'object' && errorObject !== null) {
        const errorObj = errorObject as any;
        status = errorObj.status || 500;
        message = errorObj.message || 'RPC Error';
      } else {
        message = String(errorObject);
      }
    } else if (exception.getStatus) {
      status = exception.getStatus();
      message = exception.message || 'Error';
    } else {
      message = exception.message || 'Internal Error';
    }

    console.error('📤 [AllExceptionsFilter] Returning error:', { status, message });
    return throwError(() => new RpcException({ status, message }));
  }
}
