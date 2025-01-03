/*
https://docs.nestjs.com/providers#services
*/

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisInstanceService } from 'src/module/help/redis/redis.service';

import { Channel, Connection } from 'amqplib';
import * as amqp from 'amqplib/callback_api';
import { GatewayService } from 'src/module/gateway/gateway.service';
import { MyLoggerService } from 'src/module/help/logger/logger.service';
import { RabbitMqConfig, RedisCache } from 'src/common/constanst/constanst';

@Injectable()
export class RabbitMQService {
  private readonly logger: MyLoggerService; // 添加 Logger 服务
  private readonly gatewayService: GatewayService; // 添加 Logger 服务
  private readonly redisInstanceService: RedisInstanceService;
  private readonly configService: ConfigService;
  private readonly exchange = RabbitMqConfig.defaultExchangeName; // Fanout 交换机名称
  private readonly queue = RabbitMqConfig.defaultQueueName;

  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private rabbitmqUrl: string;
  private apiKey: string;

  private readonly RECONNECT_INTERVAL = 5000; // 重连间隔 5 秒
  private readonly MAX_RECONNECT_ATTEMPTS = 10; // 最大重连次数
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(
    configService: ConfigService,
    logger: MyLoggerService,
    redisInstanceService: RedisInstanceService,
    gatewayService: GatewayService,
  ) {
    this.logger = logger;
    this.redisInstanceService = redisInstanceService;
    this.gatewayService = gatewayService;
    this.configService = configService;

    this.init();
  }
  async init(): Promise<void> {
    try {
      this.rabbitmqUrl = this.getRabbitMQUrl();
      this.initialize();
      this.redisInstanceService
        .get(RedisCache.GOST_SERVER_API_KEY)
        .then((_apiKey) => {
          this.apiKey = _apiKey;
        });
    } catch (e) {
      this.logger.error('RabbitMQ init', e);
    }
  }

  public getRabbitMQUrl(): string {
    const hostname =
      this.configService.get<string>('mq.hostname') || 'localhost';
    const port = this.configService.get<string>('mq.port') || '5672';
    const user = this.configService.get<string>('mq.user') || 'guest';
    const password = this.configService.get<string>('mq.password') || 'guest';
    const vhost = '/'; // 默认为根虚拟主机
    const url = `amqp://${user}:${password}@${hostname}:${port}${vhost !== '/' ? `/${vhost}` : ''}`;

    return url;
  }

  // 初始化连接和信道
  public async initialize(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.logger.log('[RabbitMQ]', '开始创建mq连接');
      try {
        this.createConnection(resolve, reject);
      } catch (error) {
        this.logger.error('Error initializing RabbitMQ:', error);
        this.scheduleReconnect();
        reject(false);
      }
    });
  }

  private createConnection(
    resolve: (value: boolean | PromiseLike<boolean>) => void,
    reject: (reason?: any) => void,
  ): void {
    amqp.connect(this.rabbitmqUrl, async (error0, connection) => {
      if (error0 || !connection) {
        this.logger.error('[RabbitMQ]', '连接失败:', error0);
        this.scheduleReconnect();
        reject(error0 || '创建mq连接失败');
        return;
      }

      this.setupChannel(connection, resolve, reject);

      this.connection = connection;
      this.reconnectAttempts = 0; // 重置重连计数

      // 添加连接错误处理
      connection.on('error', (err) => {
        this.logger.error('[RabbitMQ]', '连接错误:', err);
        this.scheduleReconnect();
      });

      connection.on('close', () => {
        this.logger.warn('[RabbitMQ]', '连接关闭，尝试重连');
        this.scheduleReconnect();
      });
    });
  }

  private setupChannel(
    connection: Connection,
    resolve: (value: boolean | PromiseLike<boolean>) => void,
    reject: (reason?: any) => void,
  ): void {
    connection.createChannel(async (error1, channel) => {
      if (error1) {
        this.logger.error('[RabbitMQ]', '创建Channel失败:', error1);
        reject(error1);
        return;
      }

      this.channel = channel;
      this.logger.log('[RabbitMQ]', '创建mq连接成功');

      // 添加Channel错误处理
      channel.on('error', (err) => {
        this.logger.error('[RabbitMQ]', 'Channel错误:', err);
      });

      channel.on('close', () => {
        this.logger.warn('[RabbitMQ]', 'Channel关闭');
      });

      // 设置Channel
      await this.setupExchangeAndQueue(channel);
      resolve(true);
    });
  }

  private async setupExchangeAndQueue(channel: Channel): Promise<void> {
    await channel.assertExchange(this.exchange, 'fanout', { durable: true });
    const q = await channel.assertQueue(this.queue, { durable: true });
    await channel.bindQueue(q.queue, this.exchange, '');
    this.logger.log('[RabbitMQ]', `队列 ${this.queue} 准备完成`);

    this.setupMessageConsumer(channel, q.queue);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      this.logger.error('[RabbitMQ]', '达到最大重连次数，停止重连');
      return;
    }

    this.reconnectAttempts++;
    this.logger.log(
      '[RabbitMQ]',
      `第 ${this.reconnectAttempts} 次重连，${this.RECONNECT_INTERVAL}ms 后重试`,
    );

    this.reconnectTimeout = setTimeout(() => {
      this.initialize().catch((err) => {
        this.logger.error('[RabbitMQ]', '重连失败:', err);
      });
    }, this.RECONNECT_INTERVAL);
  }

  private setupMessageConsumer(channel: Channel, queue: string): void {
    channel.consume(
      queue,
      async (msg) => {
        // console.log('msg: ', msg);
        if (msg !== null) {
          const headers = msg.properties.headers;
          const apiKey = headers['x-api-key'];
          const isValid = await this.isValidApiKey(apiKey);
          if (isValid) {
            // API key 校验函数
            this.logger.log(
              '[RabbitMQ]',
              `收到消息: ${msg.content.toString()}`,
            );
            try {
              const message = JSON.parse(msg.content.toString());
              this.handleMqMessage(message);
              channel.ack(msg); // 确认收到消息
            } catch (error) {
              this.logger.error('[RabbitMQ]', `消息解析失败: ${error.message}`);
            }
          } else {
            this.logger.error('[RabbitMQ]', `无效的 API key`);
            channel.nack(msg, false, false); // 拒绝无效的消息
          }
        }
      },
      {
        noAck: false, // 开启消息确认机制
      },
    );
  }

  // 转发消息的方法，根据方法名动态调用
  async handleMqMessage(payload: IMQMessage) {
    const { method, params } = payload;
    try {
      this.logger.log(
        '[RabbitMQ] handleMqMessage start',
        `method: ${method}, params: ${JSON.stringify(params)}`,
      );

      // 动态调用对应的服务方法
      this.gatewayService.handleRequest(method, params);
    } catch (error) {
      this.logger.error(
        '[RabbitMQ] handleMqMessage error',
        `method: ${method}, params: ${JSON.stringify(params)}`,
        error,
      );
    }
  }

  // 关闭连接
  public async closeConnection(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        console.log('RabbitMQ channel closed');
      }
      if (this.connection) {
        await this.connection.close();
        console.log('RabbitMQ connection closed');
      }
    } catch (error) {
      console.error('Error closing RabbitMQ connection:', error);
    }
  }

  private async isValidApiKey(apiKey: string): Promise<boolean> {
    // const getAllKeysAndValues =
    //   await this.redisInstanceService.getAllKeysAndValues();
    // console.log(' redis getAllKeysAndValues: ', getAllKeysAndValues);

    const key = await this.redisInstanceService.get(
      RedisCache.GOST_SERVER_API_KEY,
    );
    if (key === apiKey) return true;
    // 在这里实现你的 API key 校验逻辑
    return false;
  }

  // 发送消息的函数
  sendMessageToExchange(message: any) {
    if (!this.channel) {
      throw new Error('RabbitMQ Channel 尚未初始化');
    }

    const content = Buffer.from(JSON.stringify(message));
    this.channel.publish(this.exchange, '', content, {
      headers: { 'x-api-key': this.apiKey }, // 如果需要，可以添加 headers
    });
    this.logger.log('[RabbitMQ]', `消息发送到交换机: ${message}`);
  }
}
