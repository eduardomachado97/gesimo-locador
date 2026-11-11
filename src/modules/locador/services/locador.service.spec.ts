import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { PrismaService } from '../../../database/prisma.service';
import { StatusLocador } from '../enums/status-locador.enum';
import { TipoPessoaLocador } from '../enums/tipo-pessoa-locador.enum';
import { LocadorService } from './locador.service';

describe('LocadorService', () => {
  let service: LocadorService;

  const prismaMock = {
    locador: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    endereco_locador: {
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    locador_pessoa_fisica: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    locador_pessoa_juridica: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  // removerPropriedadesNoMicrosservicoDeImoveis() chama isso antes de inativar/excluir — por padrão
  // responde OK (nenhum contrato ativo ficaria sem representante), como a grande maioria dos casos
  // reais. Testes que precisam do bloqueio (400) sobrescrevem com mockRejectedValueOnce.
  const httpServiceMock = {
    patch: jest.fn().mockReturnValue(of({ data: {} })),
  };

  const locadorMock = {
    id: BigInt(1),
    usuario_id: BigInt(1),
    tipo_pessoa: TipoPessoaLocador.FISICA,
    email: 'joao@email.com',
    status: StatusLocador.ATIVO,
    criado_em: new Date('2026-05-23T10:00:00.000Z'),
    atualizado_em: new Date('2026-05-23T10:00:00.000Z'),
    endereco_locador: {
      locador_id: BigInt(1),
      logradouro: 'Rua das Flores',
      numero: '123',
      complemento: 'Apartamento 45',
      bairro: 'Centro',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01001000',
    },
    locador_pessoa_fisica: {
      locador_id: BigInt(1),
      nome: 'João da Silva',
      cpf: '12345678901',
      rg: null,
    },
    locador_pessoa_juridica: null,
  };

  const INCLUDE_LOCADOR_COMPLETO = {
    endereco_locador: true,
    locador_pessoa_fisica: true,
    locador_pessoa_juridica: true,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocadorService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: HttpService,
          useValue: httpServiceMock,
        },
      ],
    }).compile();

    service = module.get<LocadorService>(LocadorService);
  });

  it('deve listar locadores ativos por padrão', async () => {
    prismaMock.locador.findMany.mockResolvedValue([locadorMock]);

    const resultado = await service.listarLocadores(1);

    expect(prismaMock.locador.findMany).toHaveBeenCalledWith({
      where: {
        usuario_id: BigInt(1),
        status: StatusLocador.ATIVO,
      },
      include: INCLUDE_LOCADOR_COMPLETO,
      orderBy: {
        id: 'desc',
      },
    });

    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toMatchObject({
      id: 1,
      usuarioId: 1,
      tipoPessoa: TipoPessoaLocador.FISICA,
      nome: 'João da Silva',
      cpf: '12345678901',
      email: 'joao@email.com',
      status: StatusLocador.ATIVO,
    });
  });

  it('ADMIN lista os locadores de todos os corretores (sem filtro por usuário)', async () => {
    prismaMock.locador.findMany.mockResolvedValue([locadorMock]);

    await service.listarLocadores(99, undefined, 'ADMIN');

    expect(prismaMock.locador.findMany).toHaveBeenCalledWith({
      where: {
        status: StatusLocador.ATIVO,
      },
      include: INCLUDE_LOCADOR_COMPLETO,
      orderBy: {
        id: 'desc',
      },
    });
  });

  it('USER continua restrito aos próprios locadores, mesmo com o papel informado', async () => {
    prismaMock.locador.findMany.mockResolvedValue([locadorMock]);

    await service.listarLocadores(2, undefined, 'USER');

    expect(prismaMock.locador.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { usuario_id: BigInt(2), status: StatusLocador.ATIVO },
      }),
    );
  });

  it('ADMIN busca, edita, inativa, reativa e exclui locador de outro corretor', async () => {
    prismaMock.locador.findFirst.mockResolvedValue(locadorMock);
    prismaMock.locador.update.mockResolvedValue(locadorMock);
    prismaMock.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(prismaMock),
    );

    await service.buscarLocadorPorId(1, 99, 'ADMIN');
    await service.inativarLocador(1, 99, 'ADMIN');
    await service.reativarLocador(1, 99, 'ADMIN');
    await service.removerLocadorDefinitivo(1, 99, 'ADMIN');

    // Todas as buscas de existência ignoram o dono: filtram só pelo ID
    for (const [argumentos] of prismaMock.locador.findFirst.mock.calls.slice(-4)) {
      expect(argumentos.where).toEqual({ id: BigInt(1) });
    }
  });

  it('USER não encontra locador de outro corretor', async () => {
    prismaMock.locador.findFirst.mockResolvedValue(null);

    await expect(service.buscarLocadorPorId(1, 2, 'USER')).rejects.toThrow(
      NotFoundException,
    );

    expect(prismaMock.locador.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: BigInt(1), usuario_id: BigInt(2) },
      }),
    );
  });

  it('deve listar locadores inativos quando status for informado', async () => {
    prismaMock.locador.findMany.mockResolvedValue([
      {
        ...locadorMock,
        status: StatusLocador.INATIVO,
      },
    ]);

    const resultado = await service.listarLocadores(1, StatusLocador.INATIVO);

    expect(prismaMock.locador.findMany).toHaveBeenCalledWith({
      where: {
        usuario_id: BigInt(1),
        status: StatusLocador.INATIVO,
      },
      include: INCLUDE_LOCADOR_COMPLETO,
      orderBy: {
        id: 'desc',
      },
    });

    expect(resultado[0].status).toBe(StatusLocador.INATIVO);
  });

  it('deve lançar BadRequestException quando ID do corretor for inválido na listagem', async () => {
    await expect(service.listarLocadores(0)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('deve buscar locador por ID', async () => {
    prismaMock.locador.findFirst.mockResolvedValue(locadorMock);

    const resultado = await service.buscarLocadorPorId(1, 1);

    expect(prismaMock.locador.findFirst).toHaveBeenCalledWith({
      where: {
        id: BigInt(1),
        usuario_id: BigInt(1),
      },
      include: INCLUDE_LOCADOR_COMPLETO,
    });

    expect(resultado).toMatchObject({
      id: 1,
      usuarioId: 1,
      nome: 'João da Silva',
    });
  });

  it('deve lançar NotFoundException quando locador não existir', async () => {
    prismaMock.locador.findFirst.mockResolvedValue(null);

    await expect(service.buscarLocadorPorId(999, 1)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('deve inativar locador', async () => {
    prismaMock.locador.findFirst.mockResolvedValue(locadorMock);
    prismaMock.locador.update.mockResolvedValue({
      ...locadorMock,
      status: StatusLocador.INATIVO,
    });

    const resultado = await service.inativarLocador(1, 1);

    expect(prismaMock.locador.update).toHaveBeenCalledWith({
      where: {
        id: BigInt(1),
      },
      data: {
        status: StatusLocador.INATIVO,
      },
      include: INCLUDE_LOCADOR_COMPLETO,
    });

    expect(resultado.status).toBe(StatusLocador.INATIVO);
  });

  it('avisa microsservico-imoveis (hard=false) e repassa o Authorization ao inativar', async () => {
    prismaMock.locador.findFirst.mockResolvedValue(locadorMock);
    prismaMock.locador.update.mockResolvedValue(locadorMock);

    await service.inativarLocador(1, 1, undefined, 'Bearer token-original');

    expect(httpServiceMock.patch).toHaveBeenCalledWith(
      expect.stringContaining('/imoveis/locador/1/remover-propriedades'),
      { hard: false },
      { headers: { Authorization: 'Bearer token-original' } },
    );
  });

  it('avisa microsservico-imoveis (hard=true) ao excluir definitivamente', async () => {
    prismaMock.locador.findFirst.mockResolvedValue(locadorMock);
    prismaMock.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prismaMock));

    await service.removerLocadorDefinitivo(1, 1);

    expect(httpServiceMock.patch).toHaveBeenCalledWith(
      expect.stringContaining('/imoveis/locador/1/remover-propriedades'),
      { hard: true },
      { headers: {} },
    );
  });

  it('bloqueia a inativação quando microsservico-imoveis recusa (contrato ativo ficaria sem representante)', async () => {
    prismaMock.locador.findFirst.mockResolvedValue(locadorMock);
    // O try/catch do service trata qualquer erro lançado na chamada da mesma forma que trataria um
    // erro emitido pelo Observable via firstValueFrom — lançar direto do mock já simula isso.
    httpServiceMock.patch.mockImplementationOnce(() => {
      throw { response: { status: 400, data: { message: 'Imóvel 7 ficaria sem representante.' } } };
    });

    await expect(service.inativarLocador(1, 1)).rejects.toThrow(BadRequestException);
    expect(prismaMock.locador.update).not.toHaveBeenCalled();
  });

  it('não bloqueia a inativação quando a chamada a microsservico-imoveis falha por outro motivo (rede/fora do ar)', async () => {
    prismaMock.locador.findFirst.mockResolvedValue(locadorMock);
    prismaMock.locador.update.mockResolvedValue({ ...locadorMock, status: StatusLocador.INATIVO });
    httpServiceMock.patch.mockImplementationOnce(() => {
      throw new Error('ECONNREFUSED');
    });

    const resultado = await service.inativarLocador(1, 1);

    expect(resultado.status).toBe(StatusLocador.INATIVO);
  });

  it('deve reativar locador', async () => {
    prismaMock.locador.findFirst.mockResolvedValue({
      ...locadorMock,
      status: StatusLocador.INATIVO,
    });

    prismaMock.locador.update.mockResolvedValue({
      ...locadorMock,
      status: StatusLocador.ATIVO,
    });

    const resultado = await service.reativarLocador(1, 1);

    expect(prismaMock.locador.update).toHaveBeenCalledWith({
      where: {
        id: BigInt(1),
      },
      data: {
        status: StatusLocador.ATIVO,
      },
      include: INCLUDE_LOCADOR_COMPLETO,
    });

    expect(resultado.status).toBe(StatusLocador.ATIVO);
  });
});
