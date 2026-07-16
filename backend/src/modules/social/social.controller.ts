import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { requireIdempotencyKey } from '../../common/idempotency/idempotency-key';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import {
  ChallengeCheckInResponseDto,
  ChallengeContactInvitationResponseDto,
  ChallengeInvitationDecisionDto,
  ChallengeInvitationResponseDto,
  CreateSocialChallengeDto,
  DiscoverSocialChallengesQueryDto,
  FriendRequestDecisionDto,
  FriendRequestDecisionResponseDto,
  FriendRequestResponseDto,
  FriendResponseDto,
  InviteChallengeFriendDto,
  InviteChallengeContactDto,
  RedeemChallengeContactInvitationDto,
  SearchUsersQueryDto,
  SendFriendRequestDto,
  SocialChallengeResponseDto,
  UserSearchResultDto,
} from './dto/social.dto';
import { SocialService } from './social.service';

@ApiTags('social')
@ApiBearerAuth('firebase')
@Controller('social')
export class SocialController {
  constructor(private readonly social: SocialService) {}

  @Get('users')
  @ApiOperation({ summary: 'Search active users by unique alias' })
  @ApiOkResponse({ isArray: true, type: UserSearchResultDto })
  searchUsers(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: SearchUsersQueryDto,
  ): Promise<UserSearchResultDto[]> {
    return this.social.searchUsers(principal, query);
  }

  @Get('friends')
  @ApiOperation({ summary: 'List accepted friends' })
  @ApiOkResponse({ isArray: true, type: FriendResponseDto })
  listFriends(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<FriendResponseDto[]> {
    return this.social.listFriends(principal);
  }

  @Get('friend-requests')
  @ApiOperation({
    summary: 'List pending incoming and outgoing friend requests',
  })
  @ApiOkResponse({ isArray: true, type: FriendRequestResponseDto })
  listFriendRequests(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<FriendRequestResponseDto[]> {
    return this.social.listFriendRequests(principal);
  }

  @Post('friend-requests')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Send a consent-based friend request' })
  @ApiCreatedResponse({ type: FriendRequestResponseDto })
  sendFriendRequest(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: SendFriendRequestDto,
  ): Promise<FriendRequestResponseDto> {
    return this.social.sendFriendRequest(
      principal,
      requireIdempotencyKey(idempotencyKey),
      input.recipientUserId,
    );
  }

  @Patch('friend-requests/:requestId')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Accept or decline an incoming friend request' })
  @ApiOkResponse({ type: FriendRequestDecisionResponseDto })
  respondToFriendRequest(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
    @Body() input: FriendRequestDecisionDto,
  ): Promise<FriendRequestDecisionResponseDto> {
    return this.social.respondToFriendRequest(
      principal,
      requireIdempotencyKey(idempotencyKey),
      requestId,
      input,
    );
  }

  @Get('challenges')
  @ApiOperation({
    summary: 'List owned, joined, and pending social challenges',
  })
  @ApiOkResponse({ isArray: true, type: SocialChallengeResponseDto })
  listChallenges(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<SocialChallengeResponseDto[]> {
    return this.social.listChallenges(principal);
  }

  @Get('challenges/discover')
  @ApiOperation({ summary: 'Discover open regional activity challenges' })
  @ApiOkResponse({ isArray: true, type: SocialChallengeResponseDto })
  discoverChallenges(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: DiscoverSocialChallengesQueryDto,
  ): Promise<SocialChallengeResponseDto[]> {
    return this.social.discoverChallenges(principal, query);
  }

  @Post('challenges')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Create a structured friend or regional challenge' })
  @ApiCreatedResponse({ type: SocialChallengeResponseDto })
  createChallenge(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: CreateSocialChallengeDto,
  ): Promise<SocialChallengeResponseDto> {
    return this.social.createChallenge(
      principal,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }

  @Post('challenges/:challengeId/join')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Join an open regional activity challenge' })
  @ApiCreatedResponse({ type: ChallengeInvitationResponseDto })
  joinRegionalChallenge(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('challengeId', new ParseUUIDPipe()) challengeId: string,
  ): Promise<ChallengeInvitationResponseDto> {
    return this.social.joinRegionalChallenge(
      principal,
      requireIdempotencyKey(idempotencyKey),
      challengeId,
    );
  }

  @Post('challenges/:challengeId/check-ins')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Record one activity check-in for today' })
  @ApiCreatedResponse({ type: ChallengeCheckInResponseDto })
  checkInToChallenge(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('challengeId', new ParseUUIDPipe()) challengeId: string,
  ): Promise<ChallengeCheckInResponseDto> {
    return this.social.checkInToChallenge(
      principal,
      requireIdempotencyKey(idempotencyKey),
      challengeId,
    );
  }

  @Post('challenges/:challengeId/invitations')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Invite an accepted friend to an owned challenge' })
  @ApiCreatedResponse({ type: ChallengeInvitationResponseDto })
  inviteFriendToChallenge(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('challengeId', new ParseUUIDPipe()) challengeId: string,
    @Body() input: InviteChallengeFriendDto,
  ): Promise<ChallengeInvitationResponseDto> {
    return this.social.inviteFriendToChallenge(
      principal,
      requireIdempotencyKey(idempotencyKey),
      challengeId,
      input,
    );
  }

  @Post('challenges/:challengeId/contact-invitations')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary: 'Create an email or phone invitation link for an owned challenge',
  })
  @ApiCreatedResponse({ type: ChallengeContactInvitationResponseDto })
  inviteContactToChallenge(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('challengeId', new ParseUUIDPipe()) challengeId: string,
    @Body() input: InviteChallengeContactDto,
  ): Promise<ChallengeContactInvitationResponseDto> {
    return this.social.inviteContactToChallenge(
      principal,
      requireIdempotencyKey(idempotencyKey),
      challengeId,
      input,
    );
  }

  @Post('challenge-contact-invitations/redeem')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary: 'Redeem an email or phone challenge invitation after sign-in',
  })
  @ApiCreatedResponse({ type: ChallengeInvitationResponseDto })
  redeemContactInvitation(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: RedeemChallengeContactInvitationDto,
  ): Promise<ChallengeInvitationResponseDto> {
    return this.social.redeemContactInvitation(
      principal,
      requireIdempotencyKey(idempotencyKey),
      input.token,
    );
  }

  @Patch('challenges/:challengeId/invitations/me')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Accept or decline my challenge invitation' })
  @ApiOkResponse({ type: ChallengeInvitationResponseDto })
  respondToChallengeInvitation(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('challengeId', new ParseUUIDPipe()) challengeId: string,
    @Body() input: ChallengeInvitationDecisionDto,
  ): Promise<ChallengeInvitationResponseDto> {
    return this.social.respondToChallengeInvitation(
      principal,
      requireIdempotencyKey(idempotencyKey),
      challengeId,
      input,
    );
  }
}
