// logger.ts
import { createLogger, format, transports } from 'winston';
const DailyRotateFile = require('winston-daily-rotate-file');

// 自定义格式化
const logFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // 设置日志时间戳格式
  format.printf(({ timestamp, level, message, stack }) => {
    // 格式化日志条目，确保时间戳在消息之前
    return `${timestamp} [${level}]: ${message}${stack ? `\n${stack}` : ''}`;
  }),
);

const dailyRotateFileTransport = new DailyRotateFile({
  filename: 'logs/%DATE%-results.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m', // 每个日志文件的最大大小
  maxFiles: '14d', // 保留日志文件的时间
  level: 'info',
});

const logger = createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    dailyRotateFileTransport,
    new transports.Console({
      format: format.combine(
        format.colorize(),
        logFormat, // 使用自定义格式化
      ),
    }),
  ],
});

export default logger;
