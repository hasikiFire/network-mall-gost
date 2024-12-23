import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RequestService } from 'src/module/help/request/request.service';
import { MyLoggerService } from 'src/module/help/logger/logger.service';
import { IGostReponse } from 'types/gost';
import { UsageRecordService } from '../usageRecord/usagerecord.service';
import { DefaultGostConfig } from 'src/config/gost/gostConfig';
import { ServerService } from '../server/server.service';
import systemInfo from 'src/common/os/SystemInfo';

// 对外暴露 gost 方法-编辑套餐
// 对内初始化 gost 数据
@Injectable()
export class ConfigureService {
  private readonly gostHost: string;
  private readonly beginPort: number;
  constructor(
    private readonly configService: ConfigService,
    private readonly requestService: RequestService,
    private readonly usageRecordService: UsageRecordService,
    private readonly logger: MyLoggerService,
    private readonly serverService: ServerService,
  ) {
    this.gostHost = this.configService.get<string>('gost.host');
    this.beginPort = Number(this.configService.get<string>('app.port')) + 2; // 前两位给 gost api 用
    this.loadConfig();
  }

  async loadConfig() {
    this.loadService();
    // 废弃 PluginService auth 接口
    // this.loadUsers();
    // 废弃 流量限制通过 PluginService limiter 接口
    // this.loadLimiter();
  }
  /**
   *
   * 获取套餐里新增 services，名称为要设置为IP地址
   * @returns
   */
  async loadService() {
    const packageItems = await this.usageRecordService.findValidPackageitem();

    if (!packageItems?.length) {
      this.logger.log('[configure.service][loadService] no users add');
      return;
    } else {
      this.logger.log(
        '[configure.service][loadService] packageItems id: ',
        packageItems?.map((v) => v.id),
      );
    }
    const ip = await systemInfo.getExternalIp();
    packageItems.forEach(async (v, index) => {
      try {
        const params = {
          name: `${ip}-${v.id}`,
          addr: `:${this.beginPort + index}`,
          ...DefaultGostConfig,
        };
        this.logger.log(
          '[configure.service][loadService] update gost params',
          params,
        );
        const data = await this.requestService.post<IGostReponse>(
          `${this.gostHost}/api/config/services`,
          params,
        );

        this.logger.log(
          '[configure.service][loadService] update gost data',
          data,
        );
        if (data.msg === 'OK') {
          this.logger.log(
            '[configure.service][loadService] add Service success',
            params.name,
          );
        }
      } catch (e) {
        this.logger.error(
          '[configure.service][loadService] add Service faild',
          JSON.stringify(e),
        );
      }
    });
  }

  /**
   * @deprecated 废弃 PluginService auth 接口
   * @returns
   */
  // async loadUsers() {
  //   const users = await this.usageRecordService.findValidUsers();
  //   if (!users?.length) {
  //     this.logger.log('[configure.service][loadLimiter] no users add');
  //     return;
  //   }

  //   try {
  //     const params = {
  //       name: `auther-0`,
  //       auths: users.map((v) => ({
  //         username: `user${v.id}`, // 必须唯一，不然最后会覆盖前面的
  //         password: v.passwordHash,
  //       })),
  //     };
  //     const data = await this.requestService.post<IGostReponse>(
  //       `${this.host}/api/config/authers`,
  //       params,
  //     );

  //     if (data.msg === 'OK') {
  //       this.logger.log(
  //         '[configure.service][loadUsers] add user success',
  //         params.name,
  //       );
  //     }
  //   } catch (e) {
  //     this.logger.error('[configure.service][loadUsers] add user faild', e.msg);
  //   }
  // }

  /**
   * @deprecated 废弃 流量限制通过 PluginService limiter 接口
   * @returns
   */
  async loadLimiter() {
    const packageItems = await this.usageRecordService.findValidPackageitem();
    if (!packageItems?.length) {
      this.logger.log('[configure.service][loadLimiter] no limiter add');
      return;
    }

    packageItems.forEach(async (v) => {
      try {
        const params = {
          name: `limiter-${v.id}-test`,
          limits: [`$$ ${v.speedLimit}MB ${v.speedLimit}MB`],
        };
        const data = await this.requestService.post<IGostReponse>(
          `${this.gostHost}/api/config/limiters`,
          params,
        );

        if (data.msg === 'OK') {
          this.logger.log(
            '[configure.service][loadLimiter] add Limiter success',
            params.name,
          );
        }
      } catch (e) {
        this.logger.error(
          '[configure.service][loadLimiter] add Limiter faild',
          e,
        );
      }
    });
  }
}
