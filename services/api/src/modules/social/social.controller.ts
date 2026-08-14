import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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
  BlockedMemberResponseDto,
  BlockMemberDto,
  ChallengeCheckInResponseDto,
  ChallengeCancellationResponseDto,
  ChallengeContactInvitationResponseDto,
  ChallengeContactInvitationPreviewDto,
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
  InspectChallengeContactInvitationDto,
  RedeemChallengeContactInvitationDto,
  SearchUsersQueryDto,
  SendFriendRequestDto,
  SocialChallengeResponseDto,
  SocialRelationshipActionResponseDto,
  UserSearchResultDto,
} from './dto/social.dto';
import { SocialService } from './social.service';

@ApiTags('social')
@ApiBearerAuth('firebase')
@Controller('social')
export class SocialController {
  constructor(private readonly social: SocialService) {}

  @Get('users')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
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

  @Delete('friend-requests/:requestId')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Cancel my pending outgoing friend request' })
  @ApiOkResponse({ type: SocialRelationshipActionResponseDto })
  cancelFriendRequest(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
  ): Promise<SocialRelationshipActionResponseDto> {
    return this.social.cancelFriendRequest(
      principal,
      requireIdempotencyKey(idempotencyKey),
      requestId,
    );
  }

  @Delete('friends/:friendUserId')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Remove an accepted friendship' })
  @ApiOkResponse({ type: SocialRelationshipActionResponseDto })
  removeFriend(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('friendUserId', new ParseUUIDPipe()) friendUserId: string,
  ): Promise<SocialRelationshipActionResponseDto> {
    return this.social.removeFriend(
      principal,
      requireIdempotencyKey(idempotencyKey),
      friendUserId,
    );
  }

  @Get('blocks')
  @ApiOperation({ summary: 'List members I have blocked' })
  @ApiOkResponse({ isArray: true, type: BlockedMemberResponseDto })
  listBlocks(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<BlockedMemberResponseDto[]> {
    return this.social.listBlocks(principal);
  }

  @Post('blocks')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary: 'Block a member and remove incompatible social state',
  })
  @ApiCreatedResponse({ type: SocialRelationshipActionResponseDto })
  blockMember(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: BlockMemberDto,
  ): Promise<SocialRelationshipActionResponseDto> {
    return this.social.blockMember(
      principal,
      requireIdempotencyKey(idempotencyKey),
      input.memberUserId,
    );
  }

  @Delete('blocks/:blockedUserId')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Unblock a member without restoring prior state' })
  @ApiOkResponse({ type: SocialRelationshipActionResponseDto })
  unblockMember(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('blockedUserId', new ParseUUIDPipe()) blockedUserId: string,
  ): Promise<SocialRelationshipActionResponseDto> {
    return this.social.unblockMember(
      principal,
      requireIdempotencyKey(idempotencyKey),
      blockedUserId,
    );
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

  @Delete('challenges/:challengeId')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Cancel an owned active social challenge' })
  @ApiOkResponse({ type: ChallengeCancellationResponseDto })
  cancelChallenge(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('challengeId', new ParseUUIDPipe()) challengeId: string,
  ): Promise<ChallengeCancellationResponseDto> {
    return this.social.cancelChallenge(
      principal,
      requireIdempotencyKey(idempotencyKey),
      challengeId,
    );
  }

  @Delete('challenges/:challengeId/members/me')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Withdraw my accepted challenge membership' })
  @ApiOkResponse({ type: ChallengeInvitationResponseDto })
  withdrawFromChallenge(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('challengeId', new ParseUUIDPipe()) challengeId: string,
  ): Promise<ChallengeInvitationResponseDto> {
    return this.social.withdrawFromChallenge(
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
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
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
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
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
      input.destination,
    );
  }

  @Post('challenge-contact-invitations/inspect')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Inspect an invitation after sign-in without consuming it',
  })
  @ApiOkResponse({ type: ChallengeContactInvitationPreviewDto })
  inspectContactInvitation(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() input: InspectChallengeContactInvitationDto,
  ): Promise<ChallengeContactInvitationPreviewDto> {
    return this.social.inspectContactInvitation(principal, input.token);
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
