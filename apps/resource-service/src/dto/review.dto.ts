import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class CreateReviewDto {
  @IsUUID()
  @IsNotEmpty()
  resource_id: string;

  @IsUUID()
  @IsNotEmpty()
  user_id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  review: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  ratings: number;

  @IsOptional()
  @IsString()
  attachment_url?: string;
}

export class UpdateReviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(250)
  review?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  ratings?: number;

  @IsOptional()
  @IsString()
  attachment_url?: string;
}
