import type {
  endereco_locador,
  locador,
  locador_pessoa_fisica,
  locador_pessoa_juridica,
} from '../../../generated/prisma/client';

type LocadorCompleto = locador & {
  endereco_locador: endereco_locador | null;
  locador_pessoa_fisica?: locador_pessoa_fisica | null;
  locador_pessoa_juridica?: locador_pessoa_juridica | null;
};

export class LocadorMapper {
  static paraResposta(locador: LocadorCompleto) {
    return {
      id: Number(locador.id),
      usuarioId: Number(locador.usuario_id),
      tipoPessoa: locador.tipo_pessoa,
      email: locador.email,
      telefone: locador.telefone ?? null,
      status: locador.status,
      criadoEm: locador.criado_em,
      atualizadoEm: locador.atualizado_em,
      nome: locador.locador_pessoa_fisica?.nome ?? null,
      cpf: locador.locador_pessoa_fisica?.cpf ?? null,
      rg: locador.locador_pessoa_fisica?.rg ?? null,
      razaoSocial: locador.locador_pessoa_juridica?.razao_social ?? null,
      cnpj: locador.locador_pessoa_juridica?.cnpj ?? null,
      inscricaoEstadual:
        locador.locador_pessoa_juridica?.inscricao_estadual ?? null,
      endereco: locador.endereco_locador
        ? {
            locadorId: Number(locador.endereco_locador.locador_id),
            logradouro: locador.endereco_locador.logradouro,
            numero: locador.endereco_locador.numero,
            complemento: locador.endereco_locador.complemento,
            bairro: locador.endereco_locador.bairro,
            cidade: locador.endereco_locador.cidade,
            estado: locador.endereco_locador.estado,
            cep: locador.endereco_locador.cep,
          }
        : null,
    };
  }

  static paraListaResposta(locadores: LocadorCompleto[]) {
    return locadores.map((locador) => this.paraResposta(locador));
  }
}
