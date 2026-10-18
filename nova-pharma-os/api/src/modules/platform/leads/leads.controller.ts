import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx, PlatformRoles } from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import { LeadsService } from './leads.service';

@ApiTags('Back-office SaaS')
@Controller('platform/leads')
@PlatformRoles('super_admin', 'commercial')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  @ApiOperation({ summary: 'Prospects pharmacies' })
  list(@Ctx() ctx: RequestContext, @Query('stage') stage?: string) {
    return this.leads.list(ctx, stage);
  }

  @Get('funnel')
  @ApiOperation({ summary: 'Entonnoir commercial' })
  funnel(@Ctx() ctx: RequestContext) {
    return this.leads.funnel(ctx);
  }

  @Post()
  @ApiOperation({ summary: 'Enregistrer un prospect' })
  create(@Ctx() ctx: RequestContext, @Body() body: Record<string, unknown>) {
    return this.leads.create(ctx, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Faire évoluer un prospect' })
  update(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: { stage: string; notes?: string },
  ) {
    return this.leads.updateStage(ctx, id, body.stage, body.notes);
  }
}
