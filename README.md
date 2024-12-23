# network-mall-gost
gost 服务器监控端，处理用户管理端的数据

# dev

pnpm run dev
pnpm run start

预览：http://localhost:30000/api

# 部署

1. 复制 build/deploy.sh 到服务器目录 /var/www/network-mall-gost
2. 在上述目录下新建 prod.yaml,以 src/config/prod.yaml 为木板
3. 在上述目录下新建 .env,以 .env 为模板
4. 运行 sudo ./deploy.sh 

TODO: 区分生产测试环境

# 背景

因为存在多个国外不同地区的服务器，分别提供服务，所以每个国外服务器都需要单独起一个 gost server 作为**监控端**，去监听/修改本身的 gost 容器状态。

# 为啥使用 node？

node 运行内存小，与 庞大的 java 管理端分开

# 通信方案

采用 **RabbitMQ** 交换机，接收 [network-mall 管理端](https://github.com/hasikiFire/network-mall) 的通信内容进行处理

# 功能概要

1.  启动 Docker gost

    > 1. 根据数据库表 package_item 数据启动默认配置项
    > 2. 根据数据库表 user 数据添加默认用户

2.  转发 gost api

    > 从 RabbitMQ 队列中取消息

3.  监控用户
    > 1.  通过 gost 的 observer api 监听进出流量并落库 package_usage_record 表，如果达到 package_item 中的数据限额就移除用户。（分布式系统：多端使用写入表会不会有冲突？）
    > 2.  记录访问网站是否在审计规则内 
