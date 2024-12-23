import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupSwagger } from 'src/config/swagger/swagger.config';
import { ReqeustInterceptor } from 'src/common/interceptor/requestInterceptor';
import { ConfigService } from '@nestjs/config';
import { AllExceptionsFilter } from './common/Filter/AllExceptionsFilter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // 注册全局异常过滤器
  app.useGlobalFilters(new AllExceptionsFilter());

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port'); // 从 YAML 文件中获取配置
  app.useGlobalInterceptors(new ReqeustInterceptor());

  setupSwagger(app); // 配置 Swagger
  // 2. 以最新的数据库数据加载配置
  await app.listen(port);
}
bootstrap();

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception thrown:', error);
});
