import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../../database/prisma.service';
import { CriarLocadorDto } from '../dto/create-locador.dto';
import { AtualizarLocadorDto } from '../dto/update-locador.dto';
import { StatusLocador } from '../enums/status-locador.enum';
import { TipoPessoaLocador } from '../enums/tipo-pessoa-locador.enum';
import { LocadorMapper } from '../mappers/locador.mapper';

const INCLUDE_LOCADOR_COMPLETO = {
  endereco_locador: true,
  locador_pessoa_fisica: true,
  locador_pessoa_juridica: true,
};

function isPrismaUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

const PAPEL_ADMIN = 'ADMIN';

// Corretores (USER) enxergam e alteram apenas os locadores que cadastraram. O ADMIN acessa todos:
// para ele o filtro por usuário é omitido (objeto vazio no "where").
function filtroDeAcesso(usuarioId: number, papel?: string) {
  return papel === PAPEL_ADMIN ? {} : { usuario_id: BigInt(usuarioId) };
}

@Injectable()
export class LocadorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
  ) {}

  // Achado real: contratolocacao.idLocador só era validado como "proprietário atual" na criação do
  // contrato — inativar/excluir um locador aqui nunca avisava microsservico-imoveis, deixando
  // contratos ativos apontando pra um representante que não existe mais (hard delete) ou que não é
  // mais dono de nada (qualquer um dos dois). Diferente da chamada de recibos-locador pra
  // api-repasses (que falha em silêncio, só um detalhe de exibição): aqui, se o outro serviço
  // responder 400 (ex. "ficaria sem representante"), o erro PROPAGA e barra a operação — é a defesa
  // real contra deixar um contrato ativo órfão. Qualquer outra falha (rede, serviço fora do ar) não
  // bloqueia — não seria razoável travar uma inativação/exclusão só porque o outro serviço está fora
  // do ar nesse instante.
  private async removerPropriedadesNoMicrosservicoDeImoveis(
    idLocador: number,
    hard: boolean,
    authorization: string | undefined,
  ): Promise<void> {
    const baseUrl = process.env.IMOVEIS_MICROSERVICE_URL || 'http://localhost:3003';
    try {
      await firstValueFrom(
        this.httpService.patch(
          `${baseUrl}/imoveis/locador/${idLocador}/remover-propriedades`,
          { hard },
          { headers: authorization ? { Authorization: authorization } : {} },
        ),
      );
    } catch (erro: any) {
      if (erro?.response?.status === 400) {
        throw new BadRequestException(
          erro.response.data?.message ||
            'Não é possível concluir: um ou mais imóveis deste locador ficariam com um contrato ativo sem representante.',
        );
      }
      // Rede/serviço fora do ar/qualquer outro erro — não bloqueia a operação local.
    }
  }

  async criarLocador(
    criarLocadorDto: CriarLocadorDto,
    usuarioIdCorretorLogado: number,
  ) {
    if (criarLocadorDto.tipoPessoa === TipoPessoaLocador.FISICA) {
      if (!criarLocadorDto.nome || !criarLocadorDto.cpf) {
        throw new BadRequestException(
          'Locador pessoa física requer nome e CPF.',
        );
      }
    }

    if (criarLocadorDto.tipoPessoa === TipoPessoaLocador.JURIDICA) {
      if (!criarLocadorDto.razaoSocial || !criarLocadorDto.cnpj) {
        throw new BadRequestException(
          'Locador pessoa jurídica requer razão social e CNPJ.',
        );
      }
    }

    try {
      const locadorCriado = await this.prisma.$transaction(async (tx) => {
        const locador = await tx.locador.create({
          data: {
            usuario_id: BigInt(usuarioIdCorretorLogado),
            tipo_pessoa: criarLocadorDto.tipoPessoa,
            email: criarLocadorDto.email,
            telefone: criarLocadorDto.telefone,
            endereco_locador: {
              create: {
                logradouro: criarLocadorDto.endereco.logradouro,
                numero: criarLocadorDto.endereco.numero,
                complemento: criarLocadorDto.endereco.complemento,
                bairro: criarLocadorDto.endereco.bairro,
                cidade: criarLocadorDto.endereco.cidade,
                estado: criarLocadorDto.endereco.estado,
                cep: criarLocadorDto.endereco.cep,
              },
            },
          },
        });

        if (criarLocadorDto.tipoPessoa === TipoPessoaLocador.FISICA) {
          await tx.locador_pessoa_fisica.create({
            data: {
              locador_id: locador.id,
              nome: criarLocadorDto.nome!,
              cpf: criarLocadorDto.cpf!,
              rg: criarLocadorDto.rg,
            },
          });
        } else {
          await tx.locador_pessoa_juridica.create({
            data: {
              locador_id: locador.id,
              razao_social: criarLocadorDto.razaoSocial!,
              cnpj: criarLocadorDto.cnpj!,
              inscricao_estadual: criarLocadorDto.inscricaoEstadual,
            },
          });
        }

        return tx.locador.findUniqueOrThrow({
          where: { id: locador.id },
          include: INCLUDE_LOCADOR_COMPLETO,
        });
      });

      return LocadorMapper.paraResposta(locadorCriado);
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new ConflictException('CPF, CNPJ ou e-mail já cadastrado.');
      }

      throw error;
    }
  }

  async listarLocadores(
    usuarioIdCorretorLogado: number,
    status?: StatusLocador,
    papel?: string,
  ) {
    if (!usuarioIdCorretorLogado || usuarioIdCorretorLogado <= 0) {
      throw new BadRequestException('ID do corretor logado inválido.');
    }

    const statusFiltro = status ?? StatusLocador.ATIVO;

    const locadores = await this.prisma.locador.findMany({
      where: {
        ...filtroDeAcesso(usuarioIdCorretorLogado, papel),
        status: statusFiltro,
      },
      include: INCLUDE_LOCADOR_COMPLETO,
      orderBy: {
        id: 'desc',
      },
    });

    return LocadorMapper.paraListaResposta(locadores);
  }

  async buscarLocadorPorId(
    id: number,
    usuarioIdCorretorLogado: number,
    papel?: string,
  ) {
    if (!id || id <= 0) {
      throw new BadRequestException('ID do locador inválido.');
    }

    if (!usuarioIdCorretorLogado || usuarioIdCorretorLogado <= 0) {
      throw new BadRequestException('ID do corretor logado inválido.');
    }

    const locador = await this.prisma.locador.findFirst({
      where: {
        id: BigInt(id),
        ...filtroDeAcesso(usuarioIdCorretorLogado, papel),
      },
      include: INCLUDE_LOCADOR_COMPLETO,
    });

    if (!locador) {
      throw new NotFoundException('Locador não encontrado.');
    }

    return LocadorMapper.paraResposta(locador);
  }

  async atualizarLocador(
    id: number,
    atualizarLocadorDto: AtualizarLocadorDto,
    usuarioIdCorretorLogado: number,
    papel?: string,
  ) {
    if (!id || id <= 0) {
      throw new BadRequestException('ID do locador inválido.');
    }

    if (!usuarioIdCorretorLogado || usuarioIdCorretorLogado <= 0) {
      throw new BadRequestException('ID do corretor logado inválido.');
    }

    const locadorExistente = await this.prisma.locador.findFirst({
      where: {
        id: BigInt(id),
        ...filtroDeAcesso(usuarioIdCorretorLogado, papel),
      },
      include: INCLUDE_LOCADOR_COMPLETO,
    });

    if (!locadorExistente) {
      throw new NotFoundException('Locador não encontrado.');
    }

    const tipoPessoaFinal =
      atualizarLocadorDto.tipoPessoa ?? locadorExistente.tipo_pessoa;

    try {
      const locadorAtualizado = await this.prisma.$transaction(async (tx) => {
        if (atualizarLocadorDto.endereco) {
          await tx.endereco_locador.update({
            where: {
              locador_id: BigInt(id),
            },
            data: {
              logradouro: atualizarLocadorDto.endereco.logradouro,
              numero: atualizarLocadorDto.endereco.numero,
              complemento: atualizarLocadorDto.endereco.complemento,
              bairro: atualizarLocadorDto.endereco.bairro,
              cidade: atualizarLocadorDto.endereco.cidade,
              estado: atualizarLocadorDto.endereco.estado,
              cep: atualizarLocadorDto.endereco.cep,
            },
          });
        }

        if (tipoPessoaFinal === TipoPessoaLocador.FISICA) {
          if (locadorExistente.locador_pessoa_juridica) {
            await tx.locador_pessoa_juridica.delete({
              where: { locador_id: BigInt(id) },
            });
          }

          if (locadorExistente.locador_pessoa_fisica) {
            await tx.locador_pessoa_fisica.update({
              where: { locador_id: BigInt(id) },
              data: {
                nome: atualizarLocadorDto.nome,
                cpf: atualizarLocadorDto.cpf,
                rg: atualizarLocadorDto.rg,
              },
            });
          } else {
            if (!atualizarLocadorDto.nome || !atualizarLocadorDto.cpf) {
              throw new BadRequestException(
                'Locador pessoa física requer nome e CPF.',
              );
            }

            await tx.locador_pessoa_fisica.create({
              data: {
                locador_id: BigInt(id),
                nome: atualizarLocadorDto.nome,
                cpf: atualizarLocadorDto.cpf,
                rg: atualizarLocadorDto.rg,
              },
            });
          }
        } else if (tipoPessoaFinal === TipoPessoaLocador.JURIDICA) {
          if (locadorExistente.locador_pessoa_fisica) {
            await tx.locador_pessoa_fisica.delete({
              where: { locador_id: BigInt(id) },
            });
          }

          if (locadorExistente.locador_pessoa_juridica) {
            await tx.locador_pessoa_juridica.update({
              where: { locador_id: BigInt(id) },
              data: {
                razao_social: atualizarLocadorDto.razaoSocial,
                cnpj: atualizarLocadorDto.cnpj,
                inscricao_estadual: atualizarLocadorDto.inscricaoEstadual,
              },
            });
          } else {
            if (
              !atualizarLocadorDto.razaoSocial ||
              !atualizarLocadorDto.cnpj
            ) {
              throw new BadRequestException(
                'Locador pessoa jurídica requer razão social e CNPJ.',
              );
            }

            await tx.locador_pessoa_juridica.create({
              data: {
                locador_id: BigInt(id),
                razao_social: atualizarLocadorDto.razaoSocial,
                cnpj: atualizarLocadorDto.cnpj,
                inscricao_estadual: atualizarLocadorDto.inscricaoEstadual,
              },
            });
          }
        }

        return tx.locador.update({
          where: {
            id: BigInt(id),
          },
          data: {
            tipo_pessoa: atualizarLocadorDto.tipoPessoa,
            email: atualizarLocadorDto.email,
            telefone: atualizarLocadorDto.telefone,
          },
          include: INCLUDE_LOCADOR_COMPLETO,
        });
      });

      return LocadorMapper.paraResposta(locadorAtualizado);
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new ConflictException('CPF, CNPJ ou e-mail já cadastrado.');
      }

      throw error;
    }
  }

  async inativarLocador(
    id: number,
    usuarioIdCorretorLogado: number,
    papel?: string,
    authorization?: string,
  ) {
    if (!id || id <= 0) {
      throw new BadRequestException('ID do locador inválido.');
    }

    if (!usuarioIdCorretorLogado || usuarioIdCorretorLogado <= 0) {
      throw new BadRequestException('ID do corretor logado inválido.');
    }

    const locadorExistente = await this.prisma.locador.findFirst({
      where: {
        id: BigInt(id),
        ...filtroDeAcesso(usuarioIdCorretorLogado, papel),
      },
    });

    if (!locadorExistente) {
      throw new NotFoundException('Locador não encontrado.');
    }

    // Soft delete: a posse (propriedadeimovel) não muda — só contratos ATIVOS podem ser reatribuídos
    // (ver removerPropriedadesNoMicrosservicoDeImoveis/ImoveisController). Chamado ANTES do update:
    // se bloquear, a inativação nem acontece.
    await this.removerPropriedadesNoMicrosservicoDeImoveis(id, false, authorization);

    const locadorInativado = await this.prisma.locador.update({
      where: {
        id: BigInt(id),
      },
      data: {
        status: StatusLocador.INATIVO,
      },
      include: INCLUDE_LOCADOR_COMPLETO,
    });

    return LocadorMapper.paraResposta(locadorInativado);
  }

  async reativarLocador(
    id: number,
    usuarioIdCorretorLogado: number,
    papel?: string,
  ) {
    if (!id || id <= 0) {
      throw new BadRequestException('ID do locador inválido.');
    }

    if (!usuarioIdCorretorLogado || usuarioIdCorretorLogado <= 0) {
      throw new BadRequestException('ID do corretor logado inválido.');
    }

    const locadorExistente = await this.prisma.locador.findFirst({
      where: {
        id: BigInt(id),
        ...filtroDeAcesso(usuarioIdCorretorLogado, papel),
      },
    });

    if (!locadorExistente) {
      throw new NotFoundException('Locador não encontrado.');
    }

    const locadorReativado = await this.prisma.locador.update({
      where: {
        id: BigInt(id),
      },
      data: {
        status: StatusLocador.ATIVO,
      },
      include: INCLUDE_LOCADOR_COMPLETO,
    });

    return LocadorMapper.paraResposta(locadorReativado);
  }

  async removerLocadorDefinitivo(
    id: number,
    usuarioIdCorretorLogado: number,
    papel?: string,
    authorization?: string,
  ) {
    if (!id || id <= 0) {
      throw new BadRequestException('ID do locador inválido.');
    }

    if (!usuarioIdCorretorLogado || usuarioIdCorretorLogado <= 0) {
      throw new BadRequestException('ID do corretor logado inválido.');
    }

    const locadorExistente = await this.prisma.locador.findFirst({
      where: {
        id: BigInt(id),
        ...filtroDeAcesso(usuarioIdCorretorLogado, papel),
      },
    });

    if (!locadorExistente) {
      throw new NotFoundException('Locador não encontrado.');
    }

    // Hard delete: além de reatribuir contratos ATIVOS, remove de vez a posse (propriedadeimovel)
    // desse locador em microsservico-imoveis — sem isso, excluir o locador aqui deixaria uma
    // referência órfã de verdade lá (o ID não existiria mais em lugar nenhum). Chamado ANTES da
    // exclusão local: se bloquear, nada é apagado.
    await this.removerPropriedadesNoMicrosservicoDeImoveis(id, true, authorization);

    // As tabelas de endereço e pessoa física/jurídica possuem onDelete: Cascade,
    // mas removemos explicitamente para garantir a limpeza mesmo sem suporte a FK.
    await this.prisma.$transaction(async (tx) => {
      await tx.endereco_locador.deleteMany({
        where: { locador_id: BigInt(id) },
      });

      await tx.locador_pessoa_fisica.deleteMany({
        where: { locador_id: BigInt(id) },
      });

      await tx.locador_pessoa_juridica.deleteMany({
        where: { locador_id: BigInt(id) },
      });

      await tx.locador.delete({
        where: { id: BigInt(id) },
      });
    });

    return { message: 'Locador removido definitivamente com sucesso.' };
  }
}
