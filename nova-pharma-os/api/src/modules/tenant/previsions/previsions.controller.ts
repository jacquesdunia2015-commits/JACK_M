import { Controller, Get, Query, StreamableFile } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx, RequirePermissions } from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import { PrevisionsService } from './previsions.service';

const nombre = (v?: string) => (v === undefined || v === '' ? undefined : Number(v));

@ApiTags('Espace pharmacie')
@Controller('reports')
export class PrevisionsController {
  constructor(private readonly previsions: PrevisionsService) {}

  @Get('forecast')
  @RequirePermissions('reporting.read')
  @ApiOperation({ summary: 'Prévisions saisonnières de ventes et quantités à commander' })
  liste(@Ctx() ctx: RequestContext, @Query('horizon') horizon?: string, @Query('coverDays') coverDays?: string, @Query('safetyPercent') safetyPercent?: string) {
    return this.previsions.previsions(ctx, { horizon: nombre(horizon), coverDays: nombre(coverDays), safetyPercent: nombre(safetyPercent) });
  }

  @Get('forecast/workbook')
  @RequirePermissions('reporting.read')
  @ApiOperation({ summary: 'Prévisions et quantités à commander en classeur Excel (.xlsx)' })
  async classeur(@Ctx() ctx: RequestContext, @Query('horizon') horizon?: string, @Query('coverDays') coverDays?: string, @Query('safetyPercent') safetyPercent?: string) {
    const fichier = await this.previsions.classeur(ctx, { horizon: nombre(horizon), coverDays: nombre(coverDays), safetyPercent: nombre(safetyPercent) });
    return new StreamableFile(fichier, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="previsions-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      length: fichier.length,
    });
  }
}
