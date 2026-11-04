import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatusLocador } from '../enums/status-locador.enum';
import { TipoPessoaLocador } from '../enums/tipo-pessoa-locador.enum';
import { EnderecoLocadorResponseDto } from './endereco-locador-response.dto';

export class LocadorResponseDto {
  @ApiProperty({
    example: 1,
    description: 'ID do locador.',
  })
  id!: number;

  @ApiProperty({
    example: 1,
    description: 'ID do corretor logado responsável pelo cadastro do locador.',
  })
  usuarioId!: number;

  @ApiProperty({
    enum: TipoPessoaLocador,
    example: TipoPessoaLocador.FISICA,
    description: 'Tipo de pessoa do locador: física (CPF) ou jurídica (CNPJ).',
  })
  tipoPessoa!: TipoPessoaLocador;

  @ApiProperty({
    example: 'joao@email.com',
    description: 'E-mail do locador.',
  })
  email!: string;

  @ApiPropertyOptional({
    example: '(11) 91234-5678',
    description: 'Telefone de contato do locador.',
  })
  telefone?: string | null;

  @ApiProperty({
    enum: StatusLocador,
    example: StatusLocador.ATIVO,
    description: 'Status do locador.',
  })
  status!: StatusLocador;

  @ApiProperty({
    example: '2026-05-23T20:00:00.000Z',
    description: 'Data de criação do registro.',
  })
  criadoEm!: string;

  @ApiProperty({
    example: '2026-05-23T20:10:00.000Z',
    description: 'Data da última atualização do registro.',
  })
  atualizadoEm!: string;

  @ApiPropertyOptional({
    example: 'João da Silva',
    description: 'Nome completo do locador (pessoa física).',
  })
  nome?: string | null;

  @ApiPropertyOptional({
    example: '12345678901',
    description: 'CPF do locador (pessoa física).',
  })
  cpf?: string | null;

  @ApiPropertyOptional({
    example: '123456789',
    description: 'RG do locador (pessoa física).',
  })
  rg?: string | null;

  @ApiPropertyOptional({
    example: 'Imóveis Silva Ltda',
    description: 'Razão social do locador (pessoa jurídica).',
  })
  razaoSocial?: string | null;

  @ApiPropertyOptional({
    example: '12345678000190',
    description: 'CNPJ do locador (pessoa jurídica).',
  })
  cnpj?: string | null;

  @ApiPropertyOptional({
    example: '123456789',
    description: 'Inscrição estadual do locador (pessoa jurídica).',
  })
  inscricaoEstadual?: string | null;

  @ApiPropertyOptional({
    type: EnderecoLocadorResponseDto,
    nullable: true,
    description: 'Endereço vinculado ao locador.',
  })
  endereco?: EnderecoLocadorResponseDto | null;
}
