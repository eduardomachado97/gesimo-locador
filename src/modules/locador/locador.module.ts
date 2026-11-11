import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DatabaseModule } from '../../database/database.module';
import { LocadorController } from './controllers/locador.controller';
import { LocadorService } from './services/locador.service';

@Module({
  // HttpModule: inativar/excluir um locador chama microsservico-imoveis antes de concluir, pra
  // reatribuir representantes de contrato e evitar "donos fantasmas" — ver LocadorService.
  imports: [DatabaseModule, HttpModule],
  controllers: [LocadorController],
  providers: [LocadorService],
  exports: [LocadorService],
})
export class LocadorModule {}