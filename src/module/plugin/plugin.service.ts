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
import { IUserIncrement } from 'types/gost';

/**
 * 本模块逻辑主要给 gost 流量经过判断用，逻辑应该简单并且使用缓存，不要设置太多日志
 */
@Injectable()
export class PluginService {
  private userTotalBytes = new Map<string, IUserIncrement>();
  private serverTotalBytes = new Decimal(0);
  // private readonly UHSER_RESET_THRESHOLD = 364088; // 当 userTotalBytes 的大小达到 364,088 时重置, 50MB
  private readonly RESET_THRESHOLD = new Decimal('1e14'); // 例如，当值超过 10^18 时重置, 10PB
  private readonly BATCH_SIZE = 100;

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
   * 进入数据为总量，又是分布式，所以需要计算增量才写入数据库
   **/
  async observeUser(data: IEventsResponseDTO) {
    this.logger.log('[plugin][observeUser] data: ', JSON.stringify(data));
    // 定义增量映射表，存放每个用户的 inputBytes、outputBytes 和 totalByte
    const incrementMap = new Map<string, IUserIncrement>();
    const tempUserTotalBytes = new Map<string, IUserIncrement>();
    for (const event of data.events) {
      const userID = event.client;
      if (!userID) {
        continue;
      }
      // 计算当前事件的输入输出总量
      const inputBytes = new Decimal(event.stats?.inputBytes ?? 0);
      const outputBytes = new Decimal(event.stats?.outputBytes ?? 0);
      const totalByte = inputBytes.plus(outputBytes);
      // 本服务器已使用的总量缓存数据
      tempUserTotalBytes.set(userID, {
        inputBytes: inputBytes,
        outputBytes: outputBytes,
        totalByte: totalByte,
      });

      // 获取本服务器用户总量
      const preUserBytes = this.userTotalBytes.get(userID) || {
        inputBytes: new Decimal(0),
        outputBytes: new Decimal(0),
        totalByte: new Decimal(0),
      };
      // 获取本服务器用户增量
      const incrementByte = {
        inputBytes: inputBytes.minus(preUserBytes?.inputBytes ?? 0),
        outputBytes: outputBytes.minus(preUserBytes?.outputBytes ?? 0),
        totalByte: totalByte.minus(preUserBytes?.totalByte ?? 0),
      };
      if (incrementByte.totalByte.isZero()) {
        continue;
      }

      incrementMap.set(userID, incrementByte);
      // 定期清空 incrementMap,避免一次性写入太多数据到数据库
      if (incrementMap.size >= this.BATCH_SIZE) {
        await this.usageRecordService.updateRecordsWithLock(incrementMap);
        this.updateUserTotalBytes(tempUserTotalBytes);
        incrementMap.clear();
        this.logger.log('[plugin][observeUser] 清空 incrementMap');
      }
    }

    // 处理剩余的数据
    if (incrementMap.size > 0) {
      await this.usageRecordService.updateRecordsWithLock(incrementMap);
      this.updateUserTotalBytes(tempUserTotalBytes);
      incrementMap.clear();
    }

    // this.logger.log(
    //   '[plugin][observeUser]   userTotalBytes size ',
    //   this.userTotalBytes.size,
    //   +';data:' + JSON.stringify(Object.fromEntries(this.userTotalBytes)),
    // );
    // 定期重置 userTotalBytes,
    // 有问题,会导致数据对不上的,重启本服务也不行,依赖gostv3,得重启gostv3
    // if (this.userTotalBytes.size >= this.UHSER_RESET_THRESHOLD) {
    //   this.userTotalBytes.clear();
    //   this.logger.log('[plugin][observeUser] 清空 userTotalBytes ');
    // }
  }

  // 写入本服务器已使用的总量数据
  private updateUserTotalBytes(temp: Map<string, IUserIncrement>) {
    for (const [key, value] of temp) {
      this.userTotalBytes.set(key, value);
    }
    temp.clear();
  }

  /**
   * 进入数据为总量，需要计算增量写入数据库
   * 在 gost.yaml 中设置触发间隔，默认为5分钟
   * service 跟套餐一一对应
   **/
  async observeService(data: IEventsResponseDTO) {
    this.logger.log('[plugin][observeService] data: ', JSON.stringify(data));
    // 增量用本服务缓存的，不得直接相加
    let tempTotalBytes = new Decimal(0);
    for (const event of data.events) {
      const inputBytes = new Decimal(event.stats?.inputBytes ?? 0);
      const outputBytes = new Decimal(event.stats?.outputBytes ?? 0);
      const totalByte = inputBytes.plus(outputBytes);
      tempTotalBytes = tempTotalBytes.plus(totalByte);
    }

    const increament = tempTotalBytes.minus(this.serverTotalBytes);
    this.logger.log(
      '[plugin][observeService] 增量数据：',
      increament.toString(),
    );
    if (increament.isZero()) {
      return;
    }
    await this.serverService.updateServerWithLock(increament);
    this.serverTotalBytes = tempTotalBytes;
    // 检查是否需要重置
    if (this.serverTotalBytes.greaterThanOrEqualTo(this.RESET_THRESHOLD)) {
      this.serverTotalBytes = new Decimal(0); // 重置为 0
      this.logger.log('[plugin][observeService] 清空 serverTotalBytes  ');
    }
  }

  async auther(data: IAuthUser) {
    if (!data) {
      this.logger.error('[plugin][auther] data.username 获取不到用户数据 ');
      return false;
    }
    const userID = data.username || '';
    if (!userID) {
      this.logger.error(
        '[plugin][auther] data.username 获取不到用户ID ',
        userID,
      );
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
      this.logger.error('[plugin][auther] 找不到用户, userID: ', userID);
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
    if (!userID) {
      this.logger.error('[plugin][limiter] data.client 获取不到用户ID');
      return { in: 0, out: 0 };
    }

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
