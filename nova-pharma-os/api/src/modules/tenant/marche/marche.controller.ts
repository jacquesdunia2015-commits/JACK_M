import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, MaxLength, Min, MinLength,
  ValidateNested,
} from 'class-validator';
import { Ctx, RequirePermissions, WriteOperation } from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import { MarcheService } from './marche.service';

const DISPONIBILITES = ['in_stock', 'limited', 'on_order', 'out'];

class FicheDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isListed?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) displayName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) province?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) whatsapp?: string;
  @ApiPropertyOptional({ example: 'Goma, Bukavu, Butembo' }) @IsOptional() @IsString() @MaxLength(300) deliveryZones?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) minOrderAmount?: number;
  @ApiPropertyOptional({ example: 'Comptant à la livraison, ou 15 jours' }) @IsOptional() @IsString() @MaxLength(200) paymentTerms?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;
}

class OffreDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() productId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(160) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) dosage?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) form?: string;
  @ApiPropertyOptional({ example: 'Boîte de 100' }) @IsOptional() @IsString() @MaxLength(80) presentation?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) manufacturer?: string;
  @ApiProperty({ example: 3.5 }) @IsNumber() @Min(0.0001) unitPrice!: number;
  @ApiPropertyOptional({ example: 10 }) @IsOptional() @IsNumber() @Min(0.001) minQuantity?: number;
  @ApiPropertyOptional({ enum: DISPONIBILITES }) @IsOptional() @IsIn(DISPONIBILITES) availability?: string;
  @ApiPropertyOptional({ example: '2026-12-31' }) @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) expiryDate?: string;
}

class ModifOffreDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0.0001) unitPrice?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0.001) minQuantity?: number;
  @ApiPropertyOptional({ enum: DISPONIBILITES }) @IsOptional() @IsIn(DISPONIBILITES) availability?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) expiryDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) presentation?: string;
}

class LigneCommandeDto {
  @ApiProperty() @IsUUID() offerId!: string;
  @ApiProperty() @IsNumber() @Min(0.001) quantity!: number;
}

class CommandeDto {
  @ApiProperty() @IsUUID() sellerOrganizationId!: string;
  @ApiProperty({ type: [LigneCommandeDto] }) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => LigneCommandeDto) lines!: LigneCommandeDto[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?: string;
  @ApiPropertyOptional({ example: 'Livraison jeudi matin' }) @IsOptional() @IsString() @MaxLength(200) delivery?: string;
}

class NoteDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?: string;
}

class RefusDto {
  @ApiProperty({ example: 'Rupture chez notre fournisseur' }) @IsString() @MinLength(3) @MaxLength(500) note!: string;
}

class LigneReceptionDto {
  @ApiProperty() @IsInt() @Min(0) index!: number;
  @ApiProperty() @IsUUID() productId!: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0.001) quantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) lotNumber?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) expiryDate?: string;
}

class ReceptionDto {
  @ApiProperty({ type: [LigneReceptionDto] }) @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => LigneReceptionDto) lines!: LigneReceptionDto[];
}

@ApiTags('Espace pharmacie')
@Controller('market')
export class MarcheController {
  constructor(private readonly marche: MarcheService) {}

  @Get('seller')
  @RequirePermissions('b2b.read')
  @ApiOperation({ summary: 'Ma fiche de vendeur sur la place de marché' })
  fiche(@Ctx() ctx: RequestContext) { return this.marche.fiche(ctx); }

  @Put('seller')
  @RequirePermissions('b2b.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Régler et publier ma fiche de vendeur' })
  reglerFiche(@Ctx() ctx: RequestContext, @Body() dto: FicheDto) { return this.marche.reglerFiche(ctx, dto as Record<string, unknown>); }

  @Get('offers/mine')
  @RequirePermissions('b2b.read')
  @ApiOperation({ summary: 'Mes offres' })
  mesOffres(@Ctx() ctx: RequestContext) { return this.marche.mesOffres(ctx); }

  @Post('offers')
  @RequirePermissions('b2b.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Publier une offre (reliée ou non à un produit de mon catalogue)' })
  creerOffre(@Ctx() ctx: RequestContext, @Body() dto: OffreDto) { return this.marche.creerOffre(ctx, dto); }

  @Patch('offers/:id')
  @RequirePermissions('b2b.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Modifier ou retirer une offre' })
  modifierOffre(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ModifOffreDto) { return this.marche.modifierOffre(ctx, id, dto); }

  @Post('offers/refresh')
  @RequirePermissions('b2b.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Mettre à jour disponibilité et péremption des offres depuis mon stock' })
  actualiser(@Ctx() ctx: RequestContext) { return this.marche.actualiser(ctx); }

  @Get('search')
  @RequirePermissions('purchasing.read')
  @ApiOperation({ summary: 'Chercher un produit chez les dépôts et pharmacies de la place de marché' })
  rechercher(@Ctx() ctx: RequestContext, @Query('q') q: string, @Query('city') city?: string) { return this.marche.rechercher(ctx, q, city); }

  @Post('orders')
  @RequirePermissions('purchasing.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Commander à un vendeur de la place de marché' })
  commander(@Ctx() ctx: RequestContext, @Body() dto: CommandeDto) { return this.marche.commander(ctx, dto); }

  @Get('orders')
  @RequirePermissions('purchasing.read')
  @ApiOperation({ summary: 'Mes commandes passées (side=purchases) ou reçues (side=sales)' })
  commandes(@Ctx() ctx: RequestContext, @Query('side') side?: string) { return this.marche.commandes(ctx, side === 'sales' ? 'ventes' : 'achats'); }

  @Post('orders/:id/accept')
  @RequirePermissions('b2b.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Vendeur : accepter (crée la commande professionnelle)' })
  accepter(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: NoteDto) { return this.marche.accepter(ctx, id, dto.note); }

  @Post('orders/:id/reject')
  @RequirePermissions('b2b.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Vendeur : refuser, avec la raison' })
  refuser(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RefusDto) { return this.marche.refuser(ctx, id, dto.note); }

  @Post('orders/:id/ship')
  @RequirePermissions('b2b.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Vendeur : marquer expédiée' })
  expedier(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: NoteDto) { return this.marche.expedier(ctx, id, dto.note); }

  @Post('orders/:id/cancel')
  @RequirePermissions('purchasing.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Acheteur : annuler (avant expédition)' })
  annuler(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.marche.annuler(ctx, id); }

  @Post('orders/:id/receive')
  @RequirePermissions('purchasing.receive')
  @WriteOperation()
  @ApiOperation({ summary: 'Acheteur : réceptionner en stock (produits, lots, péremptions)' })
  recevoir(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReceptionDto) { return this.marche.recevoir(ctx, id, dto.lines); }
}
