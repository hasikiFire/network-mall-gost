// logger.ts
import { createLogger, format, transports } from 'winston';
const DailyRotateFile = require('winston-daily-rotate-file');
import { format as dateFnsFormat, toZonedTime } from 'date-fns-tz';

// 自定义格式化
const logFormat = format.combine(
  format.timestamp(), // 使用默认时间戳
  format.printf(({ timestamp, level, message, stack }) => {
    // 将时间戳转换为中国标准时间（Asia/Shanghai）
    const zonedTimestamp = toZonedTime(timestamp, 'Asia/Shanghai');
    const formattedTimestamp = dateFnsFormat(
      zonedTimestamp,
      'yyyy-MM-dd HH:mm:ss',
      {
        timeZone: 'Asia/Shanghai',
      },
    );
    return `${formattedTimestamp} [${level}]: ${message}${stack ? `\n${stack}` : ''}`;
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
