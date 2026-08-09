import { ApiProperty } from '@nestjs/swagger';
import {
  GymLocationResponseDto,
  OperatorGymSessionDto,
} from '../../gyms/dto/gym.dto';
import {
  AdminDashboardCompetitionDto,
  AdminDashboardIdentityDto,
  AdminDashboardRegionDto,
} from './admin-dashboard.dto';

export class OperatorPortalAssignmentDto {
  @ApiProperty({ enum: ['admin', 'staff'], type: String })
  accessLevel!: 'admin' | 'staff';

  @ApiProperty({ format: 'uuid', type: String })
  gymLocationId!: string;
}

export class OperatorPortalAccessDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ format: 'email', type: String })
  email!: string;

  @ApiProperty({ enum: ['gogymgo', 'partner'], type: String })
  portal!: 'gogymgo' | 'partner';

  @ApiProperty({ isArray: true, type: String })
  roles!: string[];

  @ApiProperty({ isArray: true, type: OperatorPortalAssignmentDto })
  assignments!: OperatorPortalAssignmentDto[];
}

export class PartnerGymDto extends GymLocationResponseDto {
  @ApiProperty({ enum: ['admin', 'staff'], type: String })
  accessLevel!: 'admin' | 'staff';
}

export class PartnerCompetitionDto extends AdminDashboardCompetitionDto {
  @ApiProperty({ format: 'uuid', type: String })
  gymLocationId!: string;

  @ApiProperty({ type: String })
  gymName!: string;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  proposedByUserId!: string | null;
}

export class PartnerDashboardSnapshotDto {
  @ApiProperty({ type: AdminDashboardIdentityDto })
  operator!: AdminDashboardIdentityDto;

  @ApiProperty({ isArray: true, type: PartnerGymDto })
  gyms!: PartnerGymDto[];

  @ApiProperty({ isArray: true, type: OperatorGymSessionDto })
  sessions!: OperatorGymSessionDto[];

  @ApiProperty({ isArray: true, type: PartnerCompetitionDto })
  competitions!: PartnerCompetitionDto[];

  @ApiProperty({ isArray: true, type: AdminDashboardRegionDto })
  regions!: AdminDashboardRegionDto[];

  @ApiProperty({ format: 'date-time', type: String })
  generatedAt!: string;
}
