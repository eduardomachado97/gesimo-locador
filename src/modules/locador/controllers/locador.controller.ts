import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UsuarioLogado } from '../../../common/decorators/usuario-logado.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import type { UsuarioAutenticado } from '../../../common/interfaces/usuario-autenticado.interface';
import { CriarLocadorDto } from '../dto/create-locador.dto';
import { ListarLocadoresQueryDto } from '../dto/listar-locadores-query.dto';
import { LocadorResponseDto } from '../dto/locador-response.dto';
import { AtualizarLocadorDto } from '../dto/update-locador.dto';
import { StatusLocador } from '../enums/status-locador.enum';
import { LocadorService } from '../services/locador.service';

@ApiTags('Locadores')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('USER', 'ADMIN')
@Controller('locadores')
export class LocadorController {
  constructor(private readonly locadorService: LocadorService) {}

  @Post()
  @ApiOperation({
    summary: 'Cadastrar locador',
    description:
      'Cadastra um locador com seu endereço. O usuario_id é obtido pelo token JWT do corretor logado.',
  })
  @ApiBody({ type: CriarLocadorDto })
  @ApiResponse({
    status: 201,
    description: 'Locador cadastrado com sucesso.',
    type: LocadorResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos enviados na requisição.',
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT ausente, inválido ou expirado.',
  })
  @ApiResponse({
    status: 403,
    description: 'Usuário sem permissão para acessar este recurso.',
  })
  @ApiResponse({
    status: 409,
    description: 'CPF ou e-mail já cadastrado.',
  })
  criarLocador(
    @UsuarioLogado() usuario: UsuarioAutenticado,
    @Body() criarLocadorDto: CriarLocadorDto,
  ) {
    return this.locadorService.criarLocador(criarLocadorDto, usuario.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar locadores',
    description:
      'Lista os locadores vinculados ao corretor logado. Quando o status não é informado, retorna apenas locadores ativos.',
  })
  @ApiQuery({
    name: 'status',
    enum: StatusLocador,
    required: false,
    description: 'Filtro opcional por status do locador.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de locadores retornada com sucesso.',
    type: LocadorResponseDto,
    isArray: true,
  })
  @ApiResponse({
    status: 400,
    description: 'Status inválido informado na query.',
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT ausente, inválido ou expirado.',
  })
  @ApiResponse({
    status: 403,
    description: 'Usuário sem permissão para acessar este recurso.',
  })
  listarLocadores(
    @UsuarioLogado() usuario: UsuarioAutenticado,
    @Query() query: ListarLocadoresQueryDto,
  ) {
    return this.locadorService.listarLocadores(
      usuario.id,
      query.status,
      usuario.role,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Buscar locador por ID',
    description:
      'Busca um locador específico pelo ID, desde que ele pertença ao corretor logado.',
  })
  @ApiParam({
    name: 'id',
    example: 1,
    description: 'ID do locador.',
  })
  @ApiResponse({
    status: 200,
    description: 'Locador encontrado com sucesso.',
    type: LocadorResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'ID do locador inválido.',
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT ausente, inválido ou expirado.',
  })
  @ApiResponse({
    status: 403,
    description: 'Usuário sem permissão para acessar este recurso.',
  })
  @ApiResponse({
    status: 404,
    description: 'Locador não encontrado.',
  })
  buscarLocadorPorId(
    @UsuarioLogado() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.locadorService.buscarLocadorPorId(id, usuario.id, usuario.role);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualizar locador',
    description:
      'Atualiza dados do locador e/ou endereço, desde que o locador pertença ao corretor logado.',
  })
  @ApiParam({
    name: 'id',
    example: 1,
    description: 'ID do locador.',
  })
  @ApiBody({ type: AtualizarLocadorDto })
  @ApiResponse({
    status: 200,
    description: 'Locador atualizado com sucesso.',
    type: LocadorResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos enviados na requisição.',
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT ausente, inválido ou expirado.',
  })
  @ApiResponse({
    status: 403,
    description: 'Usuário sem permissão para acessar este recurso.',
  })
  @ApiResponse({
    status: 404,
    description: 'Locador não encontrado.',
  })
  @ApiResponse({
    status: 409,
    description: 'CPF ou e-mail já cadastrado.',
  })
  atualizarLocador(
    @UsuarioLogado() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() atualizarLocadorDto: AtualizarLocadorDto,
  ) {
    return this.locadorService.atualizarLocador(
      id,
      atualizarLocadorDto,
      usuario.id,
      usuario.role,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Inativar locador',
    description:
      'Realiza exclusão lógica do locador, alterando o status para INATIVO. O registro não é removido fisicamente do banco.',
  })
  @ApiParam({
    name: 'id',
    example: 1,
    description: 'ID do locador.',
  })
  @ApiResponse({
    status: 200,
    description: 'Locador inativado com sucesso.',
    type: LocadorResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'ID do locador inválido.',
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT ausente, inválido ou expirado.',
  })
  @ApiResponse({
    status: 403,
    description: 'Usuário sem permissão para acessar este recurso.',
  })
  @ApiResponse({
    status: 404,
    description: 'Locador não encontrado.',
  })
  inativarLocador(
    @UsuarioLogado() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    return this.locadorService.inativarLocador(
      id,
      usuario.id,
      usuario.role,
      req.headers.authorization,
    );
  }

  @Patch(':id/reativar')
  @ApiOperation({
    summary: 'Reativar locador',
    description: 'Reativa um locador inativo, alterando o status para ATIVO.',
  })
  @ApiParam({
    name: 'id',
    example: 1,
    description: 'ID do locador.',
  })
  @ApiResponse({
    status: 200,
    description: 'Locador reativado com sucesso.',
    type: LocadorResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'ID do locador inválido.',
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT ausente, inválido ou expirado.',
  })
  @ApiResponse({
    status: 403,
    description: 'Usuário sem permissão para acessar este recurso.',
  })
  @ApiResponse({
    status: 404,
    description: 'Locador não encontrado.',
  })
  reativarLocador(
    @UsuarioLogado() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.locadorService.reativarLocador(id, usuario.id, usuario.role);
  }

  @Delete(':id/hard')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Hard Delete: Remover locador',
    description:
      'Realiza a exclusão física do locador e de seu endereço associado.',
  })
  @ApiParam({
    name: 'id',
    example: 1,
    description: 'ID do locador.',
  })
  @ApiResponse({
    status: 200,
    description: 'Locador removido definitivamente com sucesso.',
  })
  @ApiResponse({
    status: 400,
    description: 'ID do locador inválido.',
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT ausente, inválido ou expirado.',
  })
  @ApiResponse({
    status: 403,
    description: 'Usuário sem permissão para acessar este recurso.',
  })
  @ApiResponse({
    status: 404,
    description: 'Locador não encontrado.',
  })
  removerLocadorDefinitivo(
    @UsuarioLogado() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    return this.locadorService.removerLocadorDefinitivo(
      id,
      usuario.id,
      usuario.role,
      req.headers.authorization,
    );
  }
}