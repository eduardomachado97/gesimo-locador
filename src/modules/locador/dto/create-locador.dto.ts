import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { TipoPessoaLocador } from '../enums/tipo-pessoa-locador.enum';
import { CriarEnderecoLocadorDto } from './create-endereco-locador.dto';

export class CriarLocadorDto {
  @ApiProperty({
    enum: TipoPessoaLocador,
    example: TipoPessoaLocador.FISICA,
    description: 'Tipo de pessoa do locador: física (CPF) ou jurídica (CNPJ).',
  })
  @IsEnum(TipoPessoaLocador)
  tipoPessoa!: TipoPessoaLocador;

  @ApiProperty({
    example: 'joao@email.com',
    description: 'E-mail do locador. Deve ser único.',
  })
  @IsEmail()
  @IsNotEmpty()
  @Length(5, 150)
  email!: string;

  @ApiPropertyOptional({
    example: '(11) 91234-5678',
    description: 'Telefone de contato do locador.',
  })
  @IsOptional()
  @IsString()
  @Length(8, 20)
  telefone?: string;

  @ApiProperty({
    type: CriarEnderecoLocadorDto,
    description: 'Endereço vinculado ao locador.',
  })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => CriarEnderecoLocadorDto)
  endereco!: CriarEnderecoLocadorDto;

  // ===========================
  // Pessoa Física
  // ===========================

  @ApiPropertyOptional({
    example: 'João da Silva',
    description: 'Nome completo do locador. Obrigatório quando tipoPessoa for FISICA.',
  })
  @IsOptional()
  @IsString()
  @Length(3, 150)
  nome?: string;

  @ApiPropertyOptional({
    example: '12345678901',
    description: 'CPF do locador. Obrigatório e único quando tipoPessoa for FISICA.',
  })
  @IsOptional()
  @IsString()
  @Length(11, 14)
  cpf?: string;

  @ApiPropertyOptional({
    example: '123456789',
    description: 'RG do locador.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  rg?: string;

  // ===========================
  // Pessoa Jurídica
  // ===========================

  @ApiPropertyOptional({
    example: 'Imóveis Silva Ltda',
    description:
      'Razão social do locador. Obrigatória quando tipoPessoa for JURIDICA.',
  })
  @IsOptional()
  @IsString()
  @Length(3, 150)
  razaoSocial?: string;

  @ApiPropertyOptional({
    example: '12345678000190',
    description: 'CNPJ do locador. Obrigatório e único quando tipoPessoa for JURIDICA.',
  })
  @IsOptional()
  @IsString()
  @Length(14, 18)
  cnpj?: string;

  @ApiPropertyOptional({
    example: '123456789',
    description: 'Inscrição estadual do locador.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  inscricaoEstadual?: string;
}
