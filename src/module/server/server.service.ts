/*
https://docs.nestjs.com/providers#services
*/

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ForeignServer } from 'src/common/entities/ForeignServer';
import SystemInfo from 'src/common/os/SystemInfo';
import { Repository } from 'typeorm';
import { MyLoggerService } from '../help/logger/logger.service';
import { Cron } from '@nestjs/schedule';
import Decimal from 'decimal.js';

@Injectable()
export class ServerService {
  private ip4: string;
  constructor(
    @InjectRepository(ForeignServer)
    private readonly foreignServerRepository: Repository<ForeignServer>,

    private readonly logger: MyLoggerService,
  ) {
    this.initServerStatus();
  }

  /**
   * 加载服务器数据到数据库
   */
  async initServerStatus() {
    if (process.env.NODE_ENV === 'development_local') return;
    this.ip4 = await SystemInfo.getExternalIp();
    this.logger.log('[serverService] initServerStatus server ip: ', this.ip4);

    const serverData = await this.foreignServerRepository.findOne({
      where: {
        ipAddress: this.ip4,
      },
    });
    if (!serverData) {
      this.logger.error('[serverService] initServerStatus no server data!!');
      return;
    }
    if (serverData.status === 0) {
      serverData.status = 1;
    }
    await this.foreignServerRepository.save(serverData);
    this.logger.log('[serverService] initServerStatus success!!');
  }

  @Cron('*/10 * * * *') // 每 10 分钟执行一次
  async refreshServerStatus() {
    if (process.env.NODE_ENV == 'development_local') return;
    const serverData = await this.foreignServerRepository.findOne({
      where: {
        ipAddress: this.ip4,
      },
    });
    if (!serverData) {
      this.logger.error('[serverService] initServerStatus no server data!!');
      return;
    }

    serverData.status = 1;
    const memeryInfo = await SystemInfo.getMemoryInfo();
    serverData.ramGb = this.byteToGb(memeryInfo.total);
    serverData.remainingRamGb = this.byteToGb(memeryInfo.free);

    const cpuInfo = await SystemInfo.getCpuInfo();
    serverData.cpuCores = cpuInfo.cores;

    const diskInfo = await SystemInfo.getDiskInfo();
    serverData.storageGb = this.byteToGb(
      diskInfo.reduce((acc, cur) => acc + cur.size, 0),
    );
    serverData.consumedStorageGb = this.byteToGb(
      diskInfo.reduce((acc, cur) => acc + cur.used, 0),
    );

    // this.logger.log(
    //   '[serverService] refreshServerStatus serverData',
    //   JSON.stringify(serverData),
    // );
    await this.foreignServerRepository.save(serverData);
    this.logger.log('[serverService] refreshServerStatus success!!');
  }

  byteToGb(bytes: number) {
    if (!bytes) return '0';
    return (bytes / 1024 / 1024 / 1024).toFixed(2);
  }

  /**
   *  统计本 node 服务器的流量用量
   * @param incrementMap
   *
   */
  async updateServerWithLock(increament: Decimal) {
    try {
      await this.foreignServerRepository.manager.transaction(
        async (transactionalEntityManager) => {
          const serverData = await transactionalEntityManager
            .createQueryBuilder(ForeignServer, 'foreign_server')
            .setLock('pessimistic_write') // 行级锁
            .where('foreign_server.ip_address = :ipAddress', {
              ipAddress: this.ip4,
            })
            .getOne();

          // this.logger.log(
          //   '[pluginService][updateServerWithLock] 待更新数据量：',
          //   increament,
          // );

          if (!serverData) {
            this.logger.error(
              '[pluginService][updateServerWithLock] no server data!!',
            );
            return;
          }

          serverData.consumedDataTransfer = new Decimal(
            serverData.consumedDataTransfer,
          )
            .add(increament)
            .toString();
          if (
            new Decimal(serverData.consumedDataTransfer).greaterThanOrEqualTo(
              new Decimal(serverData.totalMonthlyDataTransfer),
            )
          ) {
            // 更新状态服务器监控用到
            serverData.isBeyondTransfer = true;
          }

          await transactionalEntityManager.save(serverData);
          this.logger.log(
            '[pluginService][updateServerWithLock]  update server data success',
          );
        },
      );
    } catch (e) {
      this.logger.error(
        '[pluginService][updateServerWithLock]  update server faild',
        e,
      );
    }
  }
}
