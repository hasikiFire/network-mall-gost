# network-mall-gost
用户订阅使用与监控端。包含用户验证，使用流量统计功能，支持分布式部署。底层框架为 [gost](https://github.com/go-gost/gost) 

# 功能
- [x] 初始化 gost 配置 
- [x] 用户验证
- [x] 记录总流量
- [x]  记录服务器状态
- [ ]  记录每日流量
- [ ]  审计规则

# 背景
因为存在多个国外不同地区的服务器，分别提供服务，所以每个国外服务器都需要单独起一个 gost server 作为**监控端**，去监听/修改本身的 gost 容器状态。 

### 为啥使用 node？
node 运行内存小，与庞大的管理端（java ）分开，毕竟服务器内存贵啊
> **node: 90MB vs java: 350MB**
 
# 开发
## 本地开发
pnpm run dev
pnpm run start

预览：http://localhost:30000/api
 ### TODO
- [ ] 区分生产测试环境
## 部署

1. 复制 build/deploy.sh 到服务器目录 /var/www/network-mall-gost
2. 在上述目录下新建 prod.yaml，以 src/config/prod.yaml 为木板
3. 在上述目录下新建 .env,以 .env 为模板
4. 运行 sudo ./deploy.sh 
 
 
 
