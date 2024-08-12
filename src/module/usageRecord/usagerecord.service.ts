/*
https://docs.nestjs.com/providers#services
*/

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PackageItem } from 'src/entities/PackageItem';
import { UsageRecord } from 'src/entities/UsageRecord';
import { User } from 'src/entities/User';
import { In, Repository } from 'typeorm';

@Injectable()
export class UsageRecordService {
  constructor(
    @InjectRepository(UsageRecord)
    private readonly UsageRecordRepository: Repository<UsageRecord>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PackageItem)
    private readonly packageItemRepository: Repository<PackageItem>,
  ) {}

  async findValidUsers(): Promise<User[]> {
    const record = await this.UsageRecordRepository.find({
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
      // TODO 获取订阅链接的 token + user_id 即可
      return users;
    }
    return [];
  }

  async findValidPackageitem(): Promise<number[]> {
    const record = await this.packageItemRepository.find({
      where: { packageStatus: 1, deleted: 0 },
    });
    console.log('record: ', record);
    if (record.length) {
      return record.filter((v) => v.deviceLimit).map((v) => v.deviceLimit);
    }
    return [];
  }
}