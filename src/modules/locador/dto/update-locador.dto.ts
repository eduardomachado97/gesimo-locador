import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { TipoPessoaLocador } from '../enums/tipo-pessoa-locador.enum';
import { AtualizarEnderecoLocadorDto } from './update-endereco-locador.dto';

export class AtualizarLocadorDto {
  @ApiPropertyOptional({
    enum: TipoPessoaLocador,
    example: TipoPessoaLocador.FISICA,
    description:
      'Tipo de pessoa do locador. Alterar o tipo substitui os dados de pessoa física/jurídica cadastrados.',
  })
  @IsEnum(TipoPessoaLocador)
  @IsOptional()
  tipoPessoa?: TipoPessoaLocador;

  @ApiPropertyOptional({
    example: 'joao.carlos@email.com',
    description: 'E-mail do locador. Deve ser único.',
  })
  @IsEmail()
  @IsOptional()
  @Length(5, 150)
  email?: string;

  @ApiPropertyOptional({
    example: '(11) 91234-5678',
    description: 'Telefone de contato do locador.',
  })
  @IsString()
  @IsOptional()
  @Length(8, 20)
  telefone?: string;

  @ApiPropertyOptional({
    type: AtualizarEnderecoLocadorDto,
    description: 'Dados opcionais do endereço do locador.',
  })
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => AtualizarEnderecoLocadorDto)
  endereco?: AtualizarEnderecoLocadorDto;

  // ===========================
  // Pessoa Física
  // ===========================

  @ApiPropertyOptional({
    example: 'João Carlos da Silva',
    description: 'Nome completo do locador.',
  })
  @IsString()
  @IsOptional()
  @Length(3, 150)
  nome?: string;

  @ApiPropertyOptional({
    example: '12345678901',
    description: 'CPF do locador. Deve ser único.',
  })
  @IsString()
  @IsOptional()
  @Length(11, 14)
  cpf?: string;

  @ApiPropertyOptional({
    example: '123456789',
    description: 'RG do locador.',
  })
  @IsString()
  @IsOptional()
  @Length(1, 20)
  rg?: string;

  // ===========================
  // Pessoa Jurídica
  // ===========================

  @ApiPropertyOptional({
    example: 'Imóveis Silva Ltda',
    description: 'Razão social do locador.',
  })
  @IsString()
  @IsOptional()
  @Length(3, 150)
  razaoSocial?: string;

  @ApiPropertyOptional({
    example: '12345678000190',
    description: 'CNPJ do locador. Deve ser único.',
  })
  @IsString()
  @IsOptional()
  @Length(14, 18)
  cnpj?: string;

  @ApiPropertyOptional({
    example: '123456789',
    description: 'Inscrição estadual do locador.',
  })
  @IsString()
  @IsOptional()
  @Length(1, 50)
  inscricaoEstadual?: string;
}
