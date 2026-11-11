import { Test, TestingModule } from '@nestjs/testing';
import { StatusLocador } from '../enums/status-locador.enum';
import { TipoPessoaLocador } from '../enums/tipo-pessoa-locador.enum';
import { LocadorController } from './locador.controller';
import { LocadorService } from '../services/locador.service';

describe('LocadorController', () => {
  let controller: LocadorController;

  const locadorServiceMock = {
    criarLocador: jest.fn(),
    listarLocadores: jest.fn(),
    buscarLocadorPorId: jest.fn(),
    atualizarLocador: jest.fn(),
    inativarLocador: jest.fn(),
    reativarLocador: jest.fn(),
  };

  const usuarioMock = {
    id: 1,
    email: 'corretor@email.com',
    role: 'USER',
  };

  const locadorResponseMock = {
    id: 1,
    usuarioId: 1,
    tipoPessoa: TipoPessoaLocador.FISICA,
    nome: 'João da Silva',
    cpf: '12345678901',
    email: 'joao@email.com',
    status: StatusLocador.ATIVO,
    criadoEm: new Date('2026-05-23T10:00:00.000Z'),
    atualizadoEm: new Date('2026-05-23T10:00:00.000Z'),
    endereco: {
      locadorId: 1,
      logradouro: 'Rua das Flores',
      numero: '123',
      complemento: 'Apartamento 45',
      bairro: 'Centro',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01001000',
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LocadorController],
      providers: [
        {
          provide: LocadorService,
          useValue: locadorServiceMock,
        },
      ],
    }).compile();

    controller = module.get<LocadorController>(LocadorController);
  });

  it('deve cadastrar locador usando o ID do usuário autenticado', async () => {
    const dto = {
      tipoPessoa: TipoPessoaLocador.FISICA,
      nome: 'João da Silva',
      cpf: '12345678901',
      email: 'joao@email.com',
      endereco: {
        logradouro: 'Rua das Flores',
        numero: '123',
        complemento: 'Apartamento 45',
        bairro: 'Centro',
        cidade: 'São Paulo',
        estado: 'SP',
        cep: '01001000',
      },
    };

    locadorServiceMock.criarLocador.mockResolvedValue(locadorResponseMock);

    const resultado = await controller.criarLocador(usuarioMock, dto);

    expect(locadorServiceMock.criarLocador).toHaveBeenCalledWith(dto, 1);
    expect(resultado).toEqual(locadorResponseMock);
  });

  it('deve listar locadores usando o ID do usuário autenticado', async () => {
    locadorServiceMock.listarLocadores.mockResolvedValue([locadorResponseMock]);

    const resultado = await controller.listarLocadores(usuarioMock, {
      status: StatusLocador.ATIVO,
    });

    expect(locadorServiceMock.listarLocadores).toHaveBeenCalledWith(
      1,
      StatusLocador.ATIVO,
      'USER',
    );
    expect(resultado).toEqual([locadorResponseMock]);
  });

  it('deve buscar locador por ID usando o ID do usuário autenticado', async () => {
    locadorServiceMock.buscarLocadorPorId.mockResolvedValue(locadorResponseMock);

    const resultado = await controller.buscarLocadorPorId(usuarioMock, 1);

    expect(locadorServiceMock.buscarLocadorPorId).toHaveBeenCalledWith(
      1,
      1,
      'USER',
    );
    expect(resultado).toEqual(locadorResponseMock);
  });

  it('deve atualizar locador usando o ID do usuário autenticado', async () => {
    const dto = {
      nome: 'João Atualizado',
    };

    locadorServiceMock.atualizarLocador.mockResolvedValue({
      ...locadorResponseMock,
      nome: 'João Atualizado',
    });

    const resultado = await controller.atualizarLocador(usuarioMock, 1, dto);

    expect(locadorServiceMock.atualizarLocador).toHaveBeenCalledWith(
      1,
      dto,
      1,
      'USER',
    );
    expect(resultado.nome).toBe('João Atualizado');
  });

  it('deve inativar locador usando o ID do usuário autenticado', async () => {
    locadorServiceMock.inativarLocador.mockResolvedValue({
      ...locadorResponseMock,
      status: StatusLocador.INATIVO,
    });

    const requisicaoMock = { headers: { authorization: 'Bearer token-de-teste' } } as any;
    const resultado = await controller.inativarLocador(usuarioMock, 1, requisicaoMock);

    expect(locadorServiceMock.inativarLocador).toHaveBeenCalledWith(
      1,
      1,
      'USER',
      'Bearer token-de-teste',
    );
    expect(resultado.status).toBe(StatusLocador.INATIVO);
  });

  it('deve reativar locador usando o ID do usuário autenticado', async () => {
    locadorServiceMock.reativarLocador.mockResolvedValue(locadorResponseMock);

    const resultado = await controller.reativarLocador(usuarioMock, 1);

    expect(locadorServiceMock.reativarLocador).toHaveBeenCalledWith(
      1,
      1,
      'USER',
    );
    expect(resultado.status).toBe(StatusLocador.ATIVO);
  });
});