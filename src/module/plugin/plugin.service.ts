import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MyLoggerService } from 'src/module/help/logger/logger.service';
import {
  IAuthUser,
  IEventsResponseDTO,
  ILimiterDTO,
  ILimiterRepostDTO,
} from 'src/common/DTO/observerDTO';
import { UsageRecord } from 'src/common/entities/UsageRecord';
import { User } from 'src/common/entities/User';
import { Repository } from 'typeorm';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CacheKey } from 'src/common/constanst/constanst';
import { UsageRecordService } from '../usageRecord/usagerecord.service';
import { ServerService } from '../server/server.service';
import Decimal from 'decimal.js';

/**
 * 本模块逻辑主要给 gost 流量经过判断用，逻辑应该简单并且使用缓存，不要设置太多日志
 */
@Injectable()
export class PluginService {
  private userTotalBytes: { [k: string]: Decimal } = {};
  private serverTotalBytes: { [k: string]: Decimal } = {};
  constructor(
    @InjectRepository(UsageRecord)
    private readonly usageRecordRepository: Repository<UsageRecord>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,

    private readonly logger: MyLoggerService,
    private readonly usageRecordService: UsageRecordService,
    private readonly serverService: ServerService,
  ) {}

  /**
   * 在 gost.yaml 中设置触发间隔，默认为5分钟
   * TODO 待观察，多用户是咋样的，有增量才会走这里吧？
   **/
  async observeUser(data: IEventsResponseDTO) {
    this.logger.log('[plugin][observeUser] data: ', JSON.stringify(data));
    // 单位字节
    const incrementMap: { [k: string]: Decimal } = {};
    // gost 程序启动后累计
    data.events.forEach((v) => {
      const userID = v.client;
      if (!userID) {
        return;
      }

      const totalByte = new Decimal(v.stats?.inputBytes ?? 0).plus(
        v.stats?.outputBytes ?? 0,
      );
      const previousTotalByte = new Decimal(this.userTotalBytes[userID] || 0);
      this.userTotalBytes[userID] = totalByte;
      const increment = totalByte.minus(previousTotalByte);
      if (increment.isZero()) return;

      // 更新增量映射表
      if (!incrementMap[userID]) {
        incrementMap[userID] = new Decimal(0);
      }
      incrementMap[userID] = incrementMap[userID].plus(increment);
    });

    this.usageRecordService.updateRecordsWithLock(incrementMap);
  }

  async observeService(data: IEventsResponseDTO) {
    this.logger.log('[plugin][observeService] data: ', JSON.stringify(data));
    // 单位字节
    const incrementMap: { [k: string]: Decimal } = {};
    const serverIncreMap: { [k: string]: Decimal } = {};
    // gost 程序启动后累计
    data.events.forEach((v) => {
      const userID = v.client;
      if (userID) {
        // 计算总字节数
        const totalByte = new Decimal(v.stats?.inputBytes ?? 0).plus(
          v.stats?.outputBytes ?? 0,
        );
        const previousTotalByte = new Decimal(this.userTotalBytes[userID] || 0);
        this.userTotalBytes[userID] = totalByte;

        // 计算增量
        const increment = totalByte.minus(previousTotalByte);
        if (increment.isZero()) return;

        // 更新 userID 的 totalByte
        if (!incrementMap[userID]) {
          incrementMap[userID] = new Decimal(0);
        }
        incrementMap[userID] = incrementMap[userID].plus(increment);
      }

      const ip = v.service.split('-').length > 1 ? v.service.split('-')[0] : '';
      if (ip) {
        // 计算总字节数
        const totalByte = new Decimal(v.stats?.inputBytes ?? 0).plus(
          v.stats?.outputBytes ?? 0,
        );
        const previousTotalByte = new Decimal(this.serverTotalBytes[ip] || 0);
        this.serverTotalBytes[ip] = totalByte;

        // 计算增量
        const increment = totalByte.minus(previousTotalByte);
        if (increment.isZero()) return;

        if (!serverIncreMap[ip]) {
          serverIncreMap[ip] = new Decimal(0);
        }
        serverIncreMap[ip] = serverIncreMap[ip].plus(increment);
      }
    });

    this.serverService.updateServerWithLock(serverIncreMap);
  }

  async auther(data: IAuthUser) {
    if (!data) return false;
    const userID = data.username || '';
    if (!userID) {
      this.logger.error('[plugin][auth] data.username 获取不到用户ID ', userID);
      return false;
    }

    const cacheKey = `${CacheKey.AUTH}-${userID}`;
    const value = await this.cacheManager.get(cacheKey);

    if (value) {
      // this.logger.log('[plugin][auth] 获取到缓存 ', userID);
      return { ok: true, id: userID };
    }

    const user = await this.userRepository.findOne({
      where: {
        id: userID,
        // 一定要校验密码，这是基础，否则拿到ID就能无脑过，后续则不用
        passwordHash: data.password,
        status: 1,
      },
    });
    if (!user) {
      this.logger.error('[plugin][auth] 找不到用户, userID: ', userID);
      return false;
    }
    // 找到有效的使用记录
    const hasValidRecord = await this.usageRecordRepository.findOne({
      where: {
        userId: userID,
        purchaseStatus: 1,
      },
    });
    if (!hasValidRecord) {
      this.logger.log(
        '[plugin][auth] 找不到套餐/套餐非生效中, userID: ',
        userID,
      );
      return false;
    }
    this.logger.log('[plugin][auth] 用户校验通过, userID: ', userID);
    // 缓存6h
    await this.cacheManager.set(cacheKey, data.username, 6 * 60 * 60 * 1000);
    return { ok: true, id: userID };
  }

  async limiter(data: ILimiterDTO): Promise<ILimiterRepostDTO> {
    // this.logger.log('[plugin][limiter] data: ', JSON.stringify(data));
    const userID = data.client;
    if (!userID) return { in: 0, out: 0 };

    const cacheKey = `${CacheKey.LIMITER}-${userID}`;
    const value = await this.cacheManager.get<number>(cacheKey);
    if (value) {
      // this.logger.log('[plugin][limiter] 获取到缓存 ', userID);
      return { in: value, out: value };
    }

    const record = await this.usageRecordRepository.findOne({
      where: {
        userId: userID,
        purchaseStatus: 1,
      },
    });
    this.logger.log('[plugin][limiter] 套餐生效中. userID: ', userID);
    if (!record || record.purchaseStatus !== 1) {
      this.logger.log(
        '[plugin][limiter] 找不到套餐/套餐非生效中, userID: ',
        userID,
      );
      return { in: 0, out: 0 };
    }
    const limitNum = record.speedLimit
      ? Number(record.speedLimit) * 1024 * 1024
      : 99999 * 1024 * 1024; // 无限制

    // 缓存6h
    await this.cacheManager.set(cacheKey, limitNum, 1 * 60 * 60 * 1000);
    this.logger.log('[plugin][limiter] 用户校验通过, 速率: ', String(limitNum));
    return { in: limitNum, out: limitNum };

    // TODO 网站过滤在此做？
  }
}
