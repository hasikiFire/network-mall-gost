/*
https://docs.nestjs.com/providers#services
*/

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CacheKey } from 'src/common/constanst/constanst';
import { PackageItem } from 'src/common/entities/PackageItem';
import { UsageRecord } from 'src/common/entities/UsageRecord';
import { User } from 'src/common/entities/User';
import { In, Repository } from 'typeorm';
import { MyLoggerService } from '../help/logger/logger.service';
import { RabbitMQService } from '../help/rabbitMQ/rabbitmq.service';
import { Cache } from 'cache-manager';
import Decimal from 'decimal.js';
import { IUserIncrement } from 'types/gost';

@Injectable()
export class UsageRecordService {
  constructor(
    @InjectRepository(UsageRecord)
    private readonly usageRecordRepository: Repository<UsageRecord>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PackageItem)
    private readonly packageItemRepository: Repository<PackageItem>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly logger: MyLoggerService,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  async findValidUsers(): Promise<User[]> {
    const record = await this.usageRecordRepository.find({
      where: { purchaseStatus: In([0, 1]) },
    });
    if (record.length) {
      const tempIds = record.map((v) => v.userId);
      const userids = Array.from(new Set(tempIds));
      const users = await this.userRepository.find({
        where: {
          id: In(userids),
        },
      });

      return users;
    }
    return [];
  }

  async findValidPackageitem(): Promise<PackageItem[]> {
    const record = await this.packageItemRepository.find({
      where: { packageStatus: 1, deleted: 0 },
    });

    return record;
  }

  /**
   * 会有死锁？
   * 死锁：事务 A 先锁定行 1，等待锁定行 2；事务 B 先锁定行 2，然后等待锁定行 1，最终两者相互等待，导致死锁
   * 分布式系统非常大概率会出现死锁！因为都是批量更新 usage_record 的场景！
   * 解决方法： 1. 对一个表而言，应尽量以固定的顺序存取表中的行
   * @param incrementMap
   */
  async updateRecordsWithLock(incrementMap: Map<string, IUserIncrement>) {
    this.logger.log(
      '[pluginService][updateRecordsWithLock] 待更新数据量：',
      JSON.stringify(Object.fromEntries(incrementMap)),
    );
    const userIds = Array.from(incrementMap.keys()).sort(); // 固定的顺序存取表中的行，这样只会发生锁的阻塞等待
    if (!userIds.length) return;
    try {
      await this.usageRecordRepository.manager.transaction(
        async (transactionalEntityManager) => {
          let records = await transactionalEntityManager
            .createQueryBuilder(UsageRecord, 'usage_record')
            .setLock('pessimistic_write') // 行级锁
            .where('usage_record.userId IN (:...ids)', { ids: userIds })
            .where('usage_record.purchaseStatus = 1')
            .getMany();
          if (!records.length) {
            this.logger.log(
              '[pluginService][updateRecordsWithLock] 查询不到可用套餐',
            );
            return;
          }

          this.logger.log(
            '[pluginService][updateRecordsWithLock] 使用记录userID：',
            records.map((v) => v.userId),
          );

          records = records.map((v) => {
            const item = incrementMap.get(v.userId);

            v.consumedDataTransfer = new Decimal(v.consumedDataTransfer ?? 0)
              .plus(new Decimal(item?.totalByte))
              .toString();
            v.consumedDataDownload = new Decimal(v.consumedDataDownload ?? 0)
              .plus(new Decimal(item?.outputBytes))
              .toString();
            v.consumedDataUpload = new Decimal(v.consumedDataUpload ?? 0)
              .plus(new Decimal(item?.inputBytes))
              .toString();

            // 使用流量到达限制
            if (item?.totalByte.greaterThanOrEqualTo(v.dataAllowance)) {
              v.purchaseStatus = 2;
            }
            return v;
          });

          await transactionalEntityManager.save(records);
          records.forEach((v) => {
            if (v.purchaseStatus === 2) {
              // 删除本系统缓存，瞬间禁用
              const lKey = `${CacheKey.LIMITER}-${v.userId}`;
              const aKey = `${CacheKey.AUTH}-${v.userId}`;
              this.cacheManager.del(lKey);
              this.cacheManager.del(aKey);
              //  通知其他 node 服务器也删除，避免用户切换服务器暂时还能用~~
              // TODO 待测试
              this.rabbitMQService.sendMessageToExchange({
                method: 'deleteUser',
                params: {
                  userID: v.userId,
                },
              });
            }
          });

          this.logger.log(
            '[pluginService][updateRecordsWithLock]  update records success',
          );
        },
      );
    } catch (e) {
      this.logger.error(
        '[pluginService][updateRecordsWithLock]  事务执行失败',
        e,
      );
      console.log('e: ', e.toString());
    }
  }
}
