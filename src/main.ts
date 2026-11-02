import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('API Locador')
    .setDescription('Microsserviço responsável pelo cadastro e gerenciamento de locadores e seus endereços.')
    .setVersion('1.0.0')
    .addTag('Locadores')
    .addTag('Health')
    .addBearerAuth()
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  const configService = app.get(ConfigService);

  const portaConfigurada = configService.get<string>('PORT');
  const porta = portaConfigurada ? Number(portaConfigurada) : 3001;

  if (Number.isNaN(porta)) {
    throw new Error('A variável de ambiente PORT deve ser um número válido.');
  }

  // Só localhost: este serviço só deve ser alcançado pelo gateway, na mesma máquina — nunca
  // diretamente pela rede (ver plano de modo Servidor/Cliente, seção de hardening).
  await app.listen(porta, '127.0.0.1');

  console.log(`API Locador executando na porta ${porta}`);
  console.log(`Swagger disponível em http://localhost:${porta}/api/docs`);
  console.log(`HealthCheck disponível em http://localhost:${porta}/health`);
}

bootstrap();