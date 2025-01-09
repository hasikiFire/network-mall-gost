import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('foreign_server', { schema: 'shop_test' })
export class ForeignServer {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    name: 'id',
    comment: '主键',
    unsigned: true,
  })
  id: string;

  @Column('varchar', {
    name: 'server_name',
    comment: '服务器的名称',
    length: 32,
  })
  serverName: string;

  @Column('varchar', {
    name: 'supplier',
    comment: '服务器的服务商',
    length: 32,
  })
  supplier: string;

  @Column('varchar', {
    name: 'domain_name',
    nullable: true,
    comment: '服务器的域名(会变动)',
    length: 255,
  })
  domainName: string | null;

  @Column('varchar', {
    name: 'ip_address',
    comment: '服务器的IP地址(会变动)',
    length: 32,
  })
  ipAddress: string;

  @Column('smallint', {
    name: 'port',
    nullable: true,
    comment: '服务器的端口号(会变动)',
  })
  port: number | null;

  @Column('timestamp', { name: 'start_date', comment: '服务器启动日期' })
  startDate: Date;

  @Column('decimal', {
    name: 'monthly_fee',
    comment: '每月费用，单位（美元）',
    precision: 10,
    scale: 2,
  })
  monthlyFee: string;

  @Column('bigint', {
    name: 'total_monthly_data_transfer',
    comment: '服务器每月默认总流量（单位：B）',
    unsigned: true,
  })
  totalMonthlyDataTransfer: string;

  @Column('bigint', {
    name: 'consumed_data_transfer',
    comment: '服务器已消耗的流量（单位：B）',
    unsigned: true,
  })
  consumedDataTransfer: string;

  @Column('varchar', {
    name: 'operating_system',
    nullable: true,
    comment: '服务器的操作系统',
    length: 255,
  })
  operatingSystem: string | null;

  @Column('tinyint', {
    name: 'cpu_cores',
    nullable: true,
    comment: '服务器的CPU核心数',
  })
  cpuCores: number | null;

  @Column('decimal', {
    name: 'ram_gb',
    nullable: true,
    comment: '服务器的总RAM大小（单位：GB）',
    precision: 10,
    scale: 0,
  })
  ramGb: string | null;

  @Column('decimal', {
    name: 'remaining_ram_gb',
    nullable: true,
    comment: '服务器剩余的RAM大小（单位：GB）',
    precision: 10,
    scale: 0,
  })
  remainingRamGb: string | null;

  @Column('decimal', {
    name: 'storage_gb',
    nullable: true,
    comment: '服务器的总存储大小（单位：GB）',
    precision: 10,
    scale: 2,
  })
  storageGb: string | null;

  @Column('decimal', {
    name: 'consumed_storage_gb',
    nullable: true,
    comment: '服务器已使用的存储大小（单位：GB）',
    precision: 10,
    scale: 2,
  })
  consumedStorageGb: string | null;

  @Column('tinyint', {
    name: 'status',
    comment: '服务器的状态。0: 停止 1：活动，2：过期',
  })
  status: number;

  @Column('tinyint', {
    name: 'is_beyond_transfer',
    nullable: true,
    comment: '是否超过默认流量包限额(1：是，0：否)',
    width: 1,
  })
  isBeyondTransfer: boolean | null;

  @Column('tinyint', {
    name: 'deleted',
    nullable: true,
    comment: '是否已删除 1：已删除 0：未删除',
    width: 1,
    default: () => "'0'",
  })
  deleted: boolean | null;

  @Column('timestamp', {
    name: 'created_at',
    comment: '创建时间',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @Column('timestamp', {
    name: 'updated_at',
    comment: '更新时间',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
