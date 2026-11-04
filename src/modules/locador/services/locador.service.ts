import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
  constructor(private readonly prisma: PrismaService) {}

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
