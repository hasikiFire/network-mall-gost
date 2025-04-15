# network-mall-gost
用户订阅使用与监控端。包含用户验证，使用流量统计功能，支持分布式部署。底层框架为 [gost](https://github.com/go-gost/gost) 


# dev

pnpm run dev
pnpm run start

预览：http://localhost:30000/api

# 部署

1. 复制 build/deploy.sh 到服务器目录 /var/www/network-mall-gost
2. 在上述目录下新建 prod.yaml，以 src/config/prod.yaml 为木板
3. 在上述目录下新建 .env,以 .env 为模板
4. 运行 sudo ./deploy.sh 
 
 # TODO
- [ ] 区分生产测试环境


# 背景
因为存在多个国外不同地区的服务器，分别提供服务，所以每个国外服务器都需要单独起一个 gost server 作为**监控端**，去监听/修改本身的 gost 容器状态。 

# 为啥使用 node？
node 运行内存小，与 庞大的管理端（java ）分开。
> **node: 90MB vs java: 350MB**


# 功能概要
 
1.  启动 Docker gost
- [x] 列表项根据数据库表 package_item 套餐数据添加 gost 服务配置项
 
2. 清除用户验证缓存
- [x] 列表项从 RabbitMQ 队列中取出消息，如删除用户，更改密码操作，立刻清楚缓存让用户使用失效（LOL）

3. 监控用户
- [x] 校验用户：通过 gost 内置API auth 接口访问数据库校验用户
- [x] 记录总流量流量：通过 gost 的 observer api 监听进出流量并落库 package_usage_record 表，达到限制就将用户状态置为无效（分布式系统：注意多端使用写入表冲突）
- [ ] 记录每日流量
- [x] 记录服务器状态
- [ ] 记录访问网站是否在审计规则内


# 与管理端 admin 通信方案
采用 **RabbitMQ** 交换机，接收 [network-mall 管理端](https://github.com/hasikiFire/network-mall) 的通信内容进行处理

 