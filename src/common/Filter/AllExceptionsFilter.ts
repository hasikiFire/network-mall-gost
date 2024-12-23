import { Catch, ExceptionFilter, ArgumentsHost } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch() // 捕获所有异常
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 打印异常信息
    console.error(exception);

    // 处理不同类型的错误
    const status = exception instanceof Error ? 500 : exception.status || 500;

    // 发送自定义的错误响应
    response.status(status).json({
      statusCode: status,
      message: exception.message || 'Internal Server Error',
      path: request.url,
    });
  }
}
