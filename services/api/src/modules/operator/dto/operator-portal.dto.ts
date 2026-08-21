import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ActiveGymQrCredentialDto } from '../../gyms/dto/gym.dto';
import { AdminDashboardGoalBracketDto } from './admin-dashboard.dto';

export class OperatorPortalAssignmentDto {
  @ApiProperty({ enum: ['admin', 'staff'], type: String })
  accessLevel!: 'admin' | 'staff';

  @ApiProperty({ format: 'uuid', type: String })
  gymLocationId!: string;
}

export class OperatorPortalAccessDto {
  @ApiProperty({ format: 'email', type: String })
  email!: string;

  @ApiProperty({ enum: ['gogymgo', 'partner'], type: String })
  portal!: 'gogymgo' | 'partner';

  @ApiProperty({ isArray: true, type: OperatorPortalAssignmentDto })
  assignments!: OperatorPortalAssignmentDto[];
}

export class PartnerPortalIdentityDto {
  @ApiProperty({ format: 'email', type: String })
  email!: string;
}

export class PartnerGymDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  address!: string;

  @ApiProperty({ format: 'uuid', type: String })
  regionPolicyId!: string;

  @ApiProperty({ type: String })
  regionCode!: string;

  @ApiProperty({ minimum: 10, type: Number })
  radiusMeters!: number;

  @ApiProperty({ enum: ['admin', 'staff'], type: String })
  accessLevel!: 'admin' | 'staff';

  @ApiProperty({ isArray: true, type: ActiveGymQrCredentialDto })
  activeQrCredentials!: ActiveGymQrCredentialDto[];
}

export class PartnerRegionDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  timezone!: string;

  @ApiProperty({ type: Boolean })
  competitionEnabled!: boolean;
}

export const partnerProposalStatuses = [
  'archived',
  'draft',
  'published',
  'submitted',
  'withdrawn',
] as const;
export type PartnerProposalStatus = (typeof partnerProposalStatuses)[number];

export class PartnerCompetitionDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ format: 'uuid', type: String })
  gymLocationId!: string;

  @ApiProperty({ type: String })
  gymName!: string;

  @ApiProperty({ format: 'uuid', type: String })
  regionPolicyId!: string;

  @ApiProperty({ type: String })
  regionCode!: string;

  @ApiProperty({ type: String })
  regionName!: string;

  @ApiProperty({ type: String })
  monthKey!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  competitionStatus!: string;

  @ApiPropertyOptional({
    enum: partnerProposalStatuses,
    nullable: true,
    type: String,
  })
  proposalStatus!: PartnerProposalStatus | null;

  @ApiPropertyOptional({ minimum: 1, nullable: true, type: Number })
  proposalVersion!: number | null;

  @ApiProperty({ minimum: 1, type: Number })
  configurationVersion!: number;

  @ApiProperty({ nullable: true, type: Number })
  entrantCap!: number | null;

  @ApiProperty({ minimum: 0, type: Number })
  enrollmentCount!: number;

  @ApiProperty({ isArray: true, type: AdminDashboardGoalBracketDto })
  goalBrackets!: AdminDashboardGoalBracketDto[];

  @ApiProperty({ format: 'date-time', type: String })
  registrationOpensAt!: string;

  @ApiProperty({ format: 'date-time', type: String })
  registrationClosesAt!: string;

  @ApiProperty({ format: 'date-time', type: String })
  startsAt!: string;

  @ApiProperty({ format: 'date-time', type: String })
  endsAt!: string;
}

export class PartnerCompetitionPageDto {
  @ApiProperty({ isArray: true, type: PartnerCompetitionDto })
  items!: PartnerCompetitionDto[];

  @ApiPropertyOptional({ nullable: true, type: String })
  nextCursor!: string | null;
}

export const partnerVisitStatuses = [
  'completed',
  'in_progress',
  'incomplete',
  'pending_review',
] as const;
export type PartnerVisitStatus = (typeof partnerVisitStatuses)[number];

export class PartnerVisitSummaryDto {
  @ApiProperty({ format: 'uuid', type: String })
  gymLocationId!: string;

  @ApiProperty({ type: String })
  gymName!: string;

  @ApiProperty({ enum: partnerVisitStatuses, type: String })
  status!: PartnerVisitStatus;

  @ApiProperty({ minimum: 1, type: Number })
  count!: number;
}

export class PartnerVisitPageDto {
  @ApiProperty({ isArray: true, type: PartnerVisitSummaryDto })
  items!: PartnerVisitSummaryDto[];

  @ApiPropertyOptional({ nullable: true, type: String })
  nextCursor!: string | null;
}

export class PartnerDashboardOverviewDto {
  @ApiProperty({ minimum: 0, type: Number })
  assignedGymCount!: number;

  @ApiProperty({ minimum: 0, type: Number })
  draftProposalCount!: number;

  @ApiProperty({ minimum: 0, type: Number })
  submittedProposalCount!: number;

  @ApiProperty({ minimum: 0, type: Number })
  activeVisitCount!: number;
}

export class PartnerDashboardSnapshotDto {
  @ApiProperty({ type: PartnerPortalIdentityDto })
  operator!: PartnerPortalIdentityDto;

  @ApiProperty({ type: PartnerDashboardOverviewDto })
  overview!: PartnerDashboardOverviewDto;

  @ApiProperty({ isArray: true, type: PartnerGymDto })
  gyms!: PartnerGymDto[];

  @ApiProperty({ type: PartnerCompetitionPageDto })
  competitions!: PartnerCompetitionPageDto;

  @ApiProperty({ type: PartnerVisitPageDto })
  visits!: PartnerVisitPageDto;

  @ApiProperty({ isArray: true, type: PartnerRegionDto })
  regions!: PartnerRegionDto[];

  @ApiProperty({ format: 'date-time', type: String })
  generatedAt!: string;
}

export class ListPartnerPortalPageQueryDto {
  @ApiPropertyOptional({ maxLength: 500, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cursor?: string;

  @ApiPropertyOptional({ default: 25, maximum: 100, minimum: 1, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Max(100)
  @Min(1)
  limit = 25;
}

export enum PartnerProposalAction {
  ARCHIVE = 'archive',
  SUBMIT = 'submit',
  WITHDRAW = 'withdraw',
}

export class PartnerProposalStatusActionDto {
  @ApiProperty({ enum: PartnerProposalAction, type: String })
  @IsEnum(PartnerProposalAction)
  action!: PartnerProposalAction;

  @ApiProperty({ minimum: 1, type: Number })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiProperty({ maxLength: 500, minLength: 8, type: String })
  @IsString()
  @Length(8, 500)
  reason!: string;
}

export class PartnerProposalActionResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ enum: partnerProposalStatuses, type: String })
  status!: PartnerProposalStatus;

  @ApiProperty({ minimum: 1, type: Number })
  version!: number;
}
