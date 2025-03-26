/*
https://docs.nestjs.com/providers#services
*/

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheKey } from 'src/common/constanst/constanst';
import { MyLoggerService } from 'src/module/help/logger/logger.service';
import { RequestService } from 'src/module/help/request/request.service';
import { IGostReponse } from 'types/gost';
import { Cache } from 'cache-manager';
import { Config, ServiceConfig } from 'src/common/DTO/gost';
import { ResultData } from 'src/common/utils/result';
import { DefaultGostConfig } from 'src/config/gost/gostConfig';

/**
 * 接受消息队列消息，调用对应方法
 */
@Injectable()
export class GatewayService {
  private allowedMethods: string[] = [
    // 'addGostService',
    // 'deleteGostService',
    // 'editGostService',
    // 'deleteExpiredPackage',
    'updateUserPassword',
    'deleteUser',
  ];
  private readonly host: string;

  constructor(
    private readonly requestService: RequestService,
    private readonly configService: ConfigService,
    private readonly logger: MyLoggerService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.host = this.configService.get<string>('gost.host');
  }

  async handleRequest(method: string, params: any): Promise<any> {
    if (this.allowedMethods.includes(method)) {
      try {
        // 动态调用 allowedMethods 列表中的方法
        await this[method](params);
        this.logger.log('[GatewayService] handleRequest success');
      } catch (error) {
        this.logger.error(
          `[GatewayService] handleRequest error. invoking method: ${method}, error:`,
          error,
        );
        // throw new Error(
        //   `Error invoking method: ${method}, details: ${error.message}`,
        // );
      }
    } else {
      this.logger.error(
        `[GatewayService] handleRequest error. Method ${method} is not allowed or does not exist.`,
      );
    }
  }

  async getGostConfig(): Promise<Config> {
    try {
      const data = await this.requestService.get<Config>(
        `${this.host}/api/config`,
      );
      return data;
    } catch (error) {
      throw new Error('新增 GOST service 失败: ' + error.message);
    }
  }

  /**
   * 新增套餐 => 新增 gost 端口
   *
   */
  async addGostService(serviceData: ServiceConfig) {
    console.log('serviceData: ', serviceData);
    const config = await this.getGostConfig();
    if (!config) {
      return ResultData.fail(
        500,
        '没有默认 gost 配置， 请确认是否启动 gost 服务',
      );
    }

    const lastService = config.services?.pop();
    let defaultAddr = 0;
    if (lastService) {
      defaultAddr = Number(lastService.addr.split(':')[1]) + 1;
    }

    try {
      const params = {
        name: serviceData.name ? serviceData.name : `service-${defaultAddr}`,
        addr: serviceData.addr ? serviceData.addr : `:${defaultAddr}`,
        ...DefaultGostConfig,
        ...serviceData,
      } as unknown as ServiceConfig;
      const data = await this.requestService.post<IGostReponse>(
        `${this.host}/api/config/services`,
        params,
      );

      if (data.msg === 'OK') {
        this.logger.log('[GostService][loadService] add Service success');
      }
      return ResultData.ok(data, '增加服务成功');
    } catch (error) {
      throw new Error('新增 GOST service 失败: ' + error.message);
    }
  }

  /**
   * 删除套餐
   * 请求 GOST API 并删除指定的服务
   */
  async deleteGostService({ serviceId }: { serviceId: string }) {
    try {
      const data = await this.requestService.delete<IGostReponse>(
        `${this.host}/api/config/services/${serviceId}`,
      );

      if (data.msg === 'OK') {
        this.logger.log(
          '[GostService][loadService] add Service success',
          serviceId,
        );
      }
      return ResultData.ok(data, '删除成功');
    } catch (error) {
      throw new Error('删除 GOST service 失败: ' + error.message);
    }
  }

  async deleteExpiredPackage(userID: string) {
    try {
      this.deleteUserCache(userID);

      return ResultData.ok();
    } catch (error) {
      console.error('处理套餐到期时出错:', error);
    }
  }

  /**
   * 删除用户的缓存信息
   * 删除缓存让用户无法通过认证
   */
  async deleteUser({ userID }: { userID: string }) {
    try {
      this.deleteUserCache(userID);
      return ResultData.ok();
    } catch (error) {
      throw new Error(`删除缓存失败: ${error.message}`);
    }
  }

  /**
   * 更新密码
   * @param userId
   * @returns
   */
  async updateUserPassword({ userID }: { userID: string }) {
    try {
      await this.deleteUserCache(userID);
      return ResultData.ok();
    } catch (error) {
      throw new Error(`修改用户密码失败: ${error.message}`);
    }
  }

  private deleteUserCache(userID: string) {
    this.logger.log(`[GatewayService][deleteUserCache] userID: ${userID}`);
    try {
      const lKey = `${CacheKey.LIMITER}-${userID}`;
      const aKey = `${CacheKey.AUTH}-${userID}`;
      this.cacheManager.del(lKey);
      this.cacheManager.del(aKey);
    } catch (error) {
      throw new Error(
        `删除用户缓存失败,id: ${userID}, msg: : ${error.message}`,
      );
    }
  }
}
