import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('pay_order_item', { schema: 'shop_test' })
export class PayOrderItem {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    name: 'id',
    comment: '主键',
    unsigned: true,
  })
  id: string;

  @Column('varchar', { name: 'order_code', comment: '订单号', length: 50 })
  orderCode: string;

  @Column('bigint', { name: 'package_id', comment: '套餐主键' })
  packageId: string;

  @Column('int', {
    name: 'package_unit',
    comment: '计费周期。单位：月份',
    default: () => "'0'",
  })
  packageUnit: number;

  @Column('varchar', { name: 'package_name', comment: '套餐名称', length: 100 })
  packageName: string;

  @Column('text', { name: 'package_desc', nullable: true, comment: '套餐描述' })
  packageDesc: string | null;

  @Column('decimal', {
    name: 'original_price',
    comment: '商品原价',
    precision: 10,
    scale: 2,
  })
  originalPrice: string;

  @Column('decimal', {
    name: 'sale_price',
    comment: '商品销售价',
    precision: 10,
    scale: 2,
    default: () => "'0.00'",
  })
  salePrice: string;

  @Column('decimal', {
    name: 'discount',
    nullable: true,
    comment: '折扣百分比',
    precision: 5,
    scale: 2,
  })
  discount: string | null;

  @Column('timestamp', {
    name: 'discount_start_date',
    nullable: true,
    comment: '折扣开始日期',
  })
  discountStartDate: Date | null;

  @Column('timestamp', {
    name: 'discount_end_date',
    nullable: true,
    comment: '折扣结束日期',
  })
  discountEndDate: Date | null;

  @Column('bigint', {
    name: 'data_allowance',
    comment: '数据流量限额（单位：B）',
  })
  dataAllowance: string;

  @Column('int', {
    name: 'device_limit',
    nullable: true,
    comment: '设备数量限制',
  })
  deviceLimit: number | null;

  @Column('bigint', {
    name: 'speed_limit',
    nullable: true,
    comment: '流量速率限额（单位：B）',
    unsigned: true,
  })
  speedLimit: string | null;

  @Column('tinyint', {
    name: 'deleted',
    nullable: true,
    comment: '是否已删除 1：已删除 0：未删除',
    default: () => "'0'",
  })
  deleted: number | null;

  @Column('timestamp', {
    name: 'created_at',
    nullable: true,
    comment: '创建时间',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date | null;

  @Column('timestamp', {
    name: 'updated_at',
    nullable: true,
    comment: '更新时间',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date | null;
}
