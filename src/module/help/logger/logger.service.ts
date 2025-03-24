// logger.service.ts
import { Injectable, LoggerService } from '@nestjs/common';
import logger from './logger';

@Injectable()
export class MyLoggerService implements LoggerService {
  log(message: any, ...context: any[]) {
    logger.info(this.formatMessage(message, ...context));
  }

  error(message: any, ...context: any[]) {
    logger.error(this.formatMessage(message, ...context));
  }

  warn(message: any, ...context: any[]) {
    logger.warn(this.formatMessage(message, ...context));
  }

  debug(message: any, ...context: any[]) {
    logger.debug(this.formatMessage(message, ...context));
  }

  verbose(message: any, ...context: any[]) {
    logger.verbose(this.formatMessage(message, ...context));
  }

  private formatMessage(message: any, ...context: any[]): string {
    // 处理 context 中的每个项，如果是数组则展平
    const contextStr = context
      .map((item) => {
        // 如果是 Error 对象，提取关键信息
        if (item instanceof Error) {
          return JSON.stringify({
            message: item.message,
            stack: item.stack,
            // 可添加其他需要的信息
          });
        }
        return JSON.stringify(item);
      })
      .join(';');

    return contextStr ? `${message}: ${contextStr}` : message;
  }
}
