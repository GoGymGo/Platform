import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { sql } from 'kysely';
import type { Kysely, Selectable, Transaction } from 'kysely';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { DatabaseService } from '../../database/database.service';
import type {
  Database,
  JsonObject,
  ProfilesTable,
  SocialChallengeActivity,
  SocialChallengeMemberStatus,
  SocialChallengeTargetPeriod,
  SocialChallengeType,
  SocialRelationshipEventAction,
  UsersTable,
} from '../../database/database.types';
import { normalizeDateKey } from '../../database/date-key';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { dateKeyInTimezone } from '../competitions/competition-calendar';
import { ProfilesService } from '../profiles/profiles.service';
import { currentRegionVerificationPredicate } from '../regions/current-region-verification';
import { loadPublicStreaks } from '../streaks/public-streaks';
import type { StreakCounts } from '../streaks/streak-calculation';
import type {
  BlockedMemberResponseDto,
  ChallengeCheckInResponseDto,
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
  SearchUsersQueryDto,
  SocialChallengeResponseDto,
  SocialRelationship,
  SocialRelationshipActionResponseDto,
  UserSearchResultDto,
} from './dto/social.dto';
import {
  lockSocialPair,
  loadBlockedUserIds,
  requireSocialPairAvailable,
} from './social-block-policy';
import { socialChallengeDateWindow } from './social-challenge-window';
import {
  contactDestinationHint,
  normalizeContactDestination,
  socialInvitationHash,
} from './social-contact';
import { requireInvitationDestinationHash } from './social-invitation-contact';

type DatabaseExecutor = Kysely<Database> | Transaction<Database>;

interface SocialUserJson extends JsonObject {
  screenName: string;
  streaks: StreakCountsJson;
  userId: string;
}

interface StreakCountsJson extends JsonObject {
  daily: number;
  monthly: number;
  projectionVersion: 'streaks-v1';
  weekly: number;
  yearly: number;
}

interface FriendRequestJson extends JsonObject {
  createdAt: string;
  direction: 'incoming' | 'outgoing';
  id: string;
  user: SocialUserJson;
}

interface FriendRequestDecisionJson extends JsonObject {
  requestId: string;
  status: 'accepted' | 'declined';
}

interface SocialRelationshipActionJson extends JsonObject {
  action: 'blocked' | 'cancelled' | 'removed' | 'unblocked';
  requestId: string | null;
  userId: string;
}

interface ChallengeMemberJson extends JsonObject {
  progress: ChallengeProgressJson;
  role: 'member' | 'owner';
  screenName: string;
  streaks: StreakCountsJson;
  status: 'accepted' | 'pending';
}

interface ChallengeProgressJson extends JsonObject {
  completedCount: number;
  completionPercent: number;
  targetTotal: number;
}

interface SocialChallengeJson extends JsonObject {
  activity: SocialChallengeActivity;
  activityLabel: string;
  canCancel: boolean;
  canCheckIn: boolean;
  canInvite: boolean;
  canJoin: boolean;
  canRespond: boolean;
  canWithdraw: boolean;
  challengeType: SocialChallengeType;
  createdAt: string;
  description: string | null;
  endDate: string;
  id: string;
  locationName: string | null;
  members: ChallengeMemberJson[];
  myProgress: ChallengeProgressJson;
  myRole: 'member' | 'owner' | null;
  myStatus: 'accepted' | 'not_joined' | 'pending';
  name: string;
  ownerScreenName: string;
  ownerStreaks: StreakCountsJson;
  participantCount: number;
  participantLimit: number | null;
  regionCode: string | null;
  regionName: string | null;
  scheduledDays: number[];
  scheduledTime: string | null;
  serverTime: string;
  startDate: string;
  state: 'active' | 'cancelled' | 'ended' | 'full' | 'upcoming';
  targetCount: number;
  targetPeriod: SocialChallengeTargetPeriod;
  timezone: string;
  contactInvitations: ChallengeContactInvitationJson[];
}

interface ChallengeInvitationJson extends JsonObject {
  challengeId: string;
  status: SocialChallengeMemberStatus;
}

interface ChallengeCancellationJson extends JsonObject {
  challengeId: string;
  state: 'cancelled';
}

interface ChallengeContactInvitationJson extends JsonObject {
  challengeId: string;
  channel: 'email' | 'phone';
  destinationHint: string;
  deliveryMode: 'link';
  deliveryStatus: 'not_sent';
  expiresAt: string;
  id: string;
  joinUrl: string;
}

interface ChallengeCheckInJson extends JsonObject {
  challengeId: string;
  checkInId: string;
  eligibleDate: string;
  source: 'manual' | 'verified_workout';
}

@Injectable()
export class SocialService {
  constructor(
    private readonly database: DatabaseService,
    private readonly idempotency: IdempotencyService,
    private readonly profiles: ProfilesService,
  ) {}

  async searchUsers(
    principal: AuthenticatedPrincipal,
    input: SearchUsersQueryDto,
  ): Promise<UserSearchResultDto[]> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const { user } = await this.ensureIdentity(principal, transaction);
        const query = input.screenName.trim().toUpperCase();
        const escapedQuery = query.replace(/[\\%_]/g, '\\$&');
        const candidates = await transaction
          .selectFrom('profiles')
          .innerJoin('users', 'users.id', 'profiles.user_id')
          .select(['profiles.screen_name', 'profiles.user_id'])
          .where('users.status', '=', 'active')
          .where('profiles.user_id', '!=', user.id)
          .where('profiles.public_identity_mode', '=', 'alias')
          .where(
            sql<boolean>`NOT EXISTS (
              SELECT 1
              FROM user_blocks AS block
              WHERE (block.blocker_user_id = ${user.id} AND block.blocked_user_id = profiles.user_id)
                 OR (block.blocker_user_id = profiles.user_id AND block.blocked_user_id = ${user.id})
            )`,
          )
          .where(
            sql<boolean>`${sql.ref('profiles.screen_name')}::text ILIKE ${`${escapedQuery}%`} ESCAPE '\\'`,
          )
          .orderBy('profiles.screen_name', 'asc')
          .limit(20)
          .execute();

        if (candidates.length === 0) {
          return [];
        }
        const candidateIds = candidates.map((candidate) => candidate.user_id);

        const streaksByUser = await loadPublicStreaks(
          transaction,
          candidateIds,
        );

        const friendships = await transaction
          .selectFrom('friendships')
          .select(['user_a_id', 'user_b_id'])
          .where((expression) =>
            expression.or([
              expression.and([
                expression('user_a_id', '=', user.id),
                expression('user_b_id', 'in', candidateIds),
              ]),
              expression.and([
                expression('user_b_id', '=', user.id),
                expression('user_a_id', 'in', candidateIds),
              ]),
            ]),
          )
          .execute();
        const friendIds = new Set(
          friendships.map((friendship) =>
            friendship.user_a_id === user.id
              ? friendship.user_b_id
              : friendship.user_a_id,
          ),
        );
        const requests = await transaction
          .selectFrom('friend_requests')
          .select(['recipient_user_id', 'requester_user_id'])
          .where('status', '=', 'pending')
          .where((expression) =>
            expression.or([
              expression.and([
                expression('requester_user_id', '=', user.id),
                expression('recipient_user_id', 'in', candidateIds),
              ]),
              expression.and([
                expression('recipient_user_id', '=', user.id),
                expression('requester_user_id', 'in', candidateIds),
              ]),
            ]),
          )
          .execute();

        const relationships = new Map<string, SocialRelationship>();
        friendIds.forEach((friendId) => relationships.set(friendId, 'friend'));
        requests.forEach((request) => {
          if (request.requester_user_id === user.id) {
            relationships.set(request.recipient_user_id, 'outgoing_request');
          } else {
            relationships.set(request.requester_user_id, 'incoming_request');
          }
        });

        return candidates
          .map((candidate) => ({
            relationship: relationships.get(candidate.user_id) ?? 'none',
            screenName: candidate.screen_name,
            streaks: this.toStreaksJson(streaksByUser.get(candidate.user_id)),
            userId: candidate.user_id,
          }))
          .sort((left, right) => {
            const leftExact =
              left.screenName.toLowerCase() === query.toLowerCase();
            const rightExact =
              right.screenName.toLowerCase() === query.toLowerCase();
            return Number(rightExact) - Number(leftExact);
          });
      });
  }

  async listFriends(
    principal: AuthenticatedPrincipal,
  ): Promise<FriendResponseDto[]> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const { user } = await this.ensureIdentity(principal, transaction);
        const friendships = await transaction
          .selectFrom('friendships')
          .selectAll()
          .where((expression) =>
            expression.or([
              expression('user_a_id', '=', user.id),
              expression('user_b_id', '=', user.id),
            ]),
          )
          .orderBy('created_at', 'desc')
          .execute();
        const blockedUserIds = await loadBlockedUserIds(transaction, user.id);
        const friendIds = friendships.map((friendship) =>
          friendship.user_a_id === user.id
            ? friendship.user_b_id
            : friendship.user_a_id,
        );
        const identities = await this.loadSocialUsers(
          transaction,
          friendIds.filter((friendId) => !blockedUserIds.has(friendId)),
        );

        return friendships.flatMap((friendship) => {
          const friendId =
            friendship.user_a_id === user.id
              ? friendship.user_b_id
              : friendship.user_a_id;
          const identity = identities.get(friendId);
          return identity
            ? [
                {
                  friendsSince: friendship.created_at.toISOString(),
                  ...identity,
                },
              ]
            : [];
        });
      });
  }

  async listFriendRequests(
    principal: AuthenticatedPrincipal,
  ): Promise<FriendRequestResponseDto[]> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const { user } = await this.ensureIdentity(principal, transaction);
        const requests = await transaction
          .selectFrom('friend_requests')
          .selectAll()
          .where('status', '=', 'pending')
          .where((expression) =>
            expression.or([
              expression('requester_user_id', '=', user.id),
              expression('recipient_user_id', '=', user.id),
            ]),
          )
          .orderBy('created_at', 'desc')
          .execute();
        const blockedUserIds = await loadBlockedUserIds(transaction, user.id);
        const otherIds = requests.map((request) =>
          request.requester_user_id === user.id
            ? request.recipient_user_id
            : request.requester_user_id,
        );
        const identities = await this.loadSocialUsers(
          transaction,
          otherIds.filter((otherId) => !blockedUserIds.has(otherId)),
        );

        return requests.flatMap((request) => {
          const outgoing = request.requester_user_id === user.id;
          const otherId = outgoing
            ? request.recipient_user_id
            : request.requester_user_id;
          const identity = identities.get(otherId);
          return identity
            ? [
                {
                  createdAt: request.created_at.toISOString(),
                  direction: outgoing
                    ? ('outgoing' as const)
                    : ('incoming' as const),
                  id: request.id,
                  user: identity,
                },
              ]
            : [];
        });
      });
  }

  async listBlocks(
    principal: AuthenticatedPrincipal,
  ): Promise<BlockedMemberResponseDto[]> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const { user } = await this.ensureIdentity(principal, transaction);
        const blocks = await transaction
          .selectFrom('user_blocks as block')
          .innerJoin('profiles', 'profiles.user_id', 'block.blocked_user_id')
          .select([
            'block.blocked_user_id',
            'block.created_at',
            'profiles.screen_name',
          ])
          .where('block.blocker_user_id', '=', user.id)
          .orderBy('block.created_at', 'desc')
          .execute();
        const streaksByUser = await loadPublicStreaks(
          transaction,
          blocks.map((block) => block.blocked_user_id),
        );
        return blocks.map((block) => ({
          blockedAt: block.created_at.toISOString(),
          screenName: block.screen_name,
          streaks: this.toStreaksJson(streaksByUser.get(block.blocked_user_id)),
          userId: block.blocked_user_id,
        }));
      });
  }

  cancelFriendRequest(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    requestId: string,
  ): Promise<SocialRelationshipActionResponseDto> {
    return this.idempotency.execute<SocialRelationshipActionJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { requestId },
        responseCode: 200,
        scope: 'social:friend-requests:cancel',
      },
      async (transaction) => {
        const { user } = await this.ensureIdentity(principal, transaction);
        const request = await transaction
          .selectFrom('friend_requests')
          .selectAll()
          .where('id', '=', requestId)
          .where('requester_user_id', '=', user.id)
          .forUpdate()
          .executeTakeFirst();
        if (!request) {
          throw new NotFoundException({
            code: 'FRIEND_REQUEST_NOT_FOUND',
            message: 'That outgoing friend request was not found.',
          });
        }
        if (request.status !== 'pending') {
          throw new ConflictException({
            code: 'FRIEND_REQUEST_ALREADY_DECIDED',
            message: 'That friend request is no longer pending.',
          });
        }
        const now = new Date();
        await transaction
          .updateTable('friend_requests')
          .set({ responded_at: now, status: 'cancelled', updated_at: now })
          .where('id', '=', request.id)
          .executeTakeFirstOrThrow();
        await this.recordSocialRelationshipEvent(transaction, {
          action: 'friend_request_cancelled',
          actorUserId: user.id,
          requestId: idempotencyKey,
          subjectUserId: request.recipient_user_id,
        });
        return {
          action: 'cancelled',
          requestId: request.id,
          userId: request.recipient_user_id,
        };
      },
    );
  }

  removeFriend(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    friendUserId: string,
  ): Promise<SocialRelationshipActionResponseDto> {
    return this.idempotency.execute<SocialRelationshipActionJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { friendUserId },
        responseCode: 200,
        scope: 'social:friends:remove',
      },
      async (transaction) => {
        const { user } = await this.ensureIdentity(principal, transaction);
        if (friendUserId === user.id) {
          throw new BadRequestException({
            code: 'SELF_SOCIAL_ACTION',
            message: 'You cannot perform that action on yourself.',
          });
        }
        await lockSocialPair(transaction, user.id, friendUserId);
        const [userA, userB] = this.canonicalPair(user.id, friendUserId);
        const removed = await transaction
          .deleteFrom('friendships')
          .where('user_a_id', '=', userA)
          .where('user_b_id', '=', userB)
          .executeTakeFirst();
        if (Number(removed.numDeletedRows) === 0) {
          throw new NotFoundException({
            code: 'FRIENDSHIP_NOT_FOUND',
            message: 'That friendship was not found.',
          });
        }
        await this.closeWeeklyChallengePairState(
          transaction,
          user.id,
          friendUserId,
          new Date(),
          'friendship_removed',
        );
        await this.recordSocialRelationshipEvent(transaction, {
          action: 'friendship_removed',
          actorUserId: user.id,
          requestId: idempotencyKey,
          subjectUserId: friendUserId,
        });
        return { action: 'removed', requestId: null, userId: friendUserId };
      },
    );
  }

  blockMember(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    memberUserId: string,
  ): Promise<SocialRelationshipActionResponseDto> {
    return this.idempotency.execute<SocialRelationshipActionJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { memberUserId },
        responseCode: 201,
        scope: 'social:blocks:create',
      },
      async (transaction) => {
        const { user } = await this.ensureIdentity(principal, transaction);
        if (memberUserId === user.id) {
          throw new BadRequestException({
            code: 'SELF_BLOCK_NOT_ALLOWED',
            message: 'You cannot block yourself.',
          });
        }
        const member = await transaction
          .selectFrom('users')
          .select('id')
          .where('id', '=', memberUserId)
          .where('status', '=', 'active')
          .executeTakeFirst();
        if (!member) {
          throw new NotFoundException({
            code: 'SOCIAL_MEMBER_NOT_AVAILABLE',
            message: 'That member is not available.',
          });
        }

        await lockSocialPair(transaction, user.id, memberUserId);

        const now = new Date();
        const inserted = await transaction
          .insertInto('user_blocks')
          .values({
            blocked_user_id: memberUserId,
            blocker_user_id: user.id,
            created_at: now,
          })
          .onConflict((conflict) =>
            conflict
              .columns(['blocker_user_id', 'blocked_user_id'])
              .doNothing(),
          )
          .returning('id')
          .executeTakeFirst();

        if (inserted) {
          await this.removeBlockedPairState(
            transaction,
            user.id,
            memberUserId,
            now,
          );
          await this.recordSocialRelationshipEvent(transaction, {
            action: 'member_blocked',
            actorUserId: user.id,
            requestId: idempotencyKey,
            subjectUserId: memberUserId,
          });
        }
        return { action: 'blocked', requestId: null, userId: memberUserId };
      },
    );
  }

  unblockMember(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    blockedUserId: string,
  ): Promise<SocialRelationshipActionResponseDto> {
    return this.idempotency.execute<SocialRelationshipActionJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { blockedUserId },
        responseCode: 200,
        scope: 'social:blocks:delete',
      },
      async (transaction) => {
        const { user } = await this.ensureIdentity(principal, transaction);
        const removed = await transaction
          .deleteFrom('user_blocks')
          .where('blocker_user_id', '=', user.id)
          .where('blocked_user_id', '=', blockedUserId)
          .executeTakeFirst();
        if (Number(removed.numDeletedRows) > 0) {
          await this.recordSocialRelationshipEvent(transaction, {
            action: 'member_unblocked',
            actorUserId: user.id,
            requestId: idempotencyKey,
            subjectUserId: blockedUserId,
          });
        }
        return { action: 'unblocked', requestId: null, userId: blockedUserId };
      },
    );
  }

  async sendFriendRequest(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    recipientUserId: string,
  ): Promise<FriendRequestResponseDto> {
    try {
      return await this.idempotency.execute<FriendRequestJson>(
        {
          actorKey: `firebase:${principal.firebaseUid}`,
          key: idempotencyKey,
          request: { recipientUserId },
          responseCode: 201,
          scope: 'social:friend-requests:create',
        },
        async (transaction) => {
          const { user } = await this.ensureIdentity(principal, transaction);
          if (recipientUserId === user.id) {
            throw new BadRequestException({
              code: 'SELF_FRIEND_REQUEST',
              message: 'You cannot send a friend request to yourself.',
            });
          }

          const recipient = await transaction
            .selectFrom('profiles')
            .innerJoin('users', 'users.id', 'profiles.user_id')
            .select(['profiles.screen_name', 'profiles.user_id'])
            .where('profiles.user_id', '=', recipientUserId)
            .where('users.status', '=', 'active')
            .executeTakeFirst();
          if (!recipient) {
            throw new NotFoundException({
              code: 'USER_NOT_FOUND',
              message: 'That user is not available.',
            });
          }
          await lockSocialPair(transaction, user.id, recipientUserId);
          await requireSocialPairAvailable(
            transaction,
            user.id,
            recipientUserId,
          );
          const recipientStreaks = this.toStreaksJson(
            (await loadPublicStreaks(transaction, [recipientUserId])).get(
              recipientUserId,
            ),
          );

          const [userA, userB] = this.canonicalPair(user.id, recipientUserId);
          const friendship = await transaction
            .selectFrom('friendships')
            .select('user_a_id')
            .where('user_a_id', '=', userA)
            .where('user_b_id', '=', userB)
            .executeTakeFirst();
          if (friendship) {
            throw new ConflictException({
              code: 'ALREADY_FRIENDS',
              message: 'You are already friends with that user.',
            });
          }

          const pending = await transaction
            .selectFrom('friend_requests')
            .selectAll()
            .where('status', '=', 'pending')
            .where((expression) =>
              expression.or([
                expression.and([
                  expression('requester_user_id', '=', user.id),
                  expression('recipient_user_id', '=', recipientUserId),
                ]),
                expression.and([
                  expression('requester_user_id', '=', recipientUserId),
                  expression('recipient_user_id', '=', user.id),
                ]),
              ]),
            )
            .forUpdate()
            .executeTakeFirst();
          if (pending?.requester_user_id === recipientUserId) {
            throw new ConflictException({
              code: 'INCOMING_FRIEND_REQUEST_PENDING',
              message: 'That user has already sent you a friend request.',
            });
          }
          if (pending) {
            return {
              createdAt: pending.created_at.toISOString(),
              direction: 'outgoing',
              id: pending.id,
              user: {
                screenName: recipient.screen_name,
                streaks: recipientStreaks,
                userId: recipient.user_id,
              },
            };
          }

          const now = new Date();
          const request = await transaction
            .insertInto('friend_requests')
            .values({
              created_at: now,
              recipient_user_id: recipientUserId,
              requester_user_id: user.id,
              responded_at: null,
              status: 'pending',
              updated_at: now,
            })
            .returningAll()
            .executeTakeFirstOrThrow();
          await this.recordSocialRelationshipEvent(transaction, {
            action: 'friend_request_sent',
            actorUserId: user.id,
            requestId: idempotencyKey,
            subjectUserId: recipientUserId,
          });
          return {
            createdAt: request.created_at.toISOString(),
            direction: 'outgoing',
            id: request.id,
            user: {
              screenName: recipient.screen_name,
              streaks: recipientStreaks,
              userId: recipient.user_id,
            },
          };
        },
      );
    } catch (error: unknown) {
      if (
        this.isConstraintViolation(error, 'friend_requests_one_pending_pair')
      ) {
        throw new ConflictException({
          code: 'FRIEND_REQUEST_ALREADY_PENDING',
          message: 'A friend request is already pending between these users.',
        });
      }
      throw error;
    }
  }

  respondToFriendRequest(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    requestId: string,
    input: FriendRequestDecisionDto,
  ): Promise<FriendRequestDecisionResponseDto> {
    return this.idempotency.execute<FriendRequestDecisionJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { decision: input.decision, requestId },
        scope: 'social:friend-requests:respond',
      },
      async (transaction) => {
        const { user } = await this.ensureIdentity(principal, transaction);
        const requestIdentity = await transaction
          .selectFrom('friend_requests')
          .select(['recipient_user_id', 'requester_user_id'])
          .where('id', '=', requestId)
          .where('recipient_user_id', '=', user.id)
          .executeTakeFirst();
        if (!requestIdentity) {
          throw new NotFoundException({
            code: 'FRIEND_REQUEST_NOT_FOUND',
            message: 'That incoming friend request was not found.',
          });
        }
        await lockSocialPair(
          transaction,
          requestIdentity.requester_user_id,
          requestIdentity.recipient_user_id,
        );
        const request = await transaction
          .selectFrom('friend_requests')
          .selectAll()
          .where('id', '=', requestId)
          .where('recipient_user_id', '=', user.id)
          .forUpdate()
          .executeTakeFirstOrThrow();
        await requireSocialPairAvailable(
          transaction,
          request.requester_user_id,
          request.recipient_user_id,
        );
        if (request.status !== 'pending') {
          throw new ConflictException({
            code: 'FRIEND_REQUEST_ALREADY_DECIDED',
            message: 'That friend request has already been decided.',
          });
        }

        const now = new Date();
        await transaction
          .updateTable('friend_requests')
          .set({
            responded_at: now,
            status: input.decision,
            updated_at: now,
          })
          .where('id', '=', request.id)
          .executeTakeFirstOrThrow();
        if (input.decision === 'accepted') {
          const [userA, userB] = this.canonicalPair(
            request.requester_user_id,
            request.recipient_user_id,
          );
          await transaction
            .insertInto('friendships')
            .values({ created_at: now, user_a_id: userA, user_b_id: userB })
            .onConflict((conflict) =>
              conflict.columns(['user_a_id', 'user_b_id']).doNothing(),
            )
            .execute();
        }
        await this.recordSocialRelationshipEvent(transaction, {
          action:
            input.decision === 'accepted'
              ? 'friend_request_accepted'
              : 'friend_request_declined',
          actorUserId: user.id,
          requestId: idempotencyKey,
          subjectUserId: request.requester_user_id,
        });

        return { requestId: request.id, status: input.decision };
      },
    );
  }

  async listChallenges(
    principal: AuthenticatedPrincipal,
  ): Promise<SocialChallengeResponseDto[]> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const { user } = await this.ensureIdentity(principal, transaction);
        return this.loadChallenges(transaction, user.id);
      });
  }

  async discoverChallenges(
    principal: AuthenticatedPrincipal,
    input: DiscoverSocialChallengesQueryDto,
  ): Promise<SocialChallengeResponseDto[]> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const { user } = await this.ensureIdentity(principal, transaction);
        const region = await this.resolveApprovedRegionPolicy(
          transaction,
          user.id,
          input.regionCode,
        );
        const today = dateKeyInTimezone(new Date(), region.timezone);
        const challenges = await transaction
          .selectFrom('social_challenges')
          .select('id')
          .where('challenge_type', '=', 'regional')
          .where('region_policy_id', '=', region.id)
          .where('status', '=', 'active')
          .where('end_date', '>=', today)
          .where(
            sql<boolean>`NOT EXISTS (
              SELECT 1
              FROM user_blocks AS block
              WHERE (block.blocker_user_id = ${user.id} AND block.blocked_user_id = social_challenges.owner_user_id)
                 OR (block.blocker_user_id = social_challenges.owner_user_id AND block.blocked_user_id = ${user.id})
            )`,
          )
          .orderBy('start_date')
          .orderBy('created_at', 'desc')
          .limit(100)
          .execute();
        return this.loadChallengeDetails(
          transaction,
          user.id,
          challenges.map(({ id }) => id),
        );
      });
  }

  createChallenge(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    input: CreateSocialChallengeDto,
  ): Promise<SocialChallengeResponseDto> {
    const name = input.name.trim().replace(/\s+/g, ' ');
    const activityLabel = input.activityLabel.trim().replace(/\s+/g, ' ');
    const description = input.description?.trim().replace(/\s+/g, ' ') || null;
    const locationName =
      input.locationName?.trim().replace(/\s+/g, ' ') || null;
    const invitedFriendUserIds = [...new Set(input.invitedFriendUserIds)];
    const invitedContacts = [
      ...new Map(
        (input.invitedContacts ?? []).map((contact) => {
          const destination = normalizeContactDestination(
            contact.channel,
            contact.destination,
          );
          return [
            `${contact.channel}:${destination}`,
            { channel: contact.channel, destination },
          ] as const;
        }),
      ).values(),
    ];
    if (!name) {
      throw new BadRequestException({
        code: 'CHALLENGE_NAME_REQUIRED',
        message: 'Enter a name for the challenge.',
      });
    }
    this.assertChallengeWindow(input.startDate, input.endDate);
    if (input.challengeType === 'friend') {
      if (invitedFriendUserIds.length + invitedContacts.length === 0) {
        throw new BadRequestException({
          code: 'FRIEND_CHALLENGE_INVITATION_REQUIRED',
          message:
            'Choose an accepted friend or create an email or phone invitation link.',
        });
      }
      if (
        input.regionCode ||
        locationName ||
        input.scheduledTime ||
        input.scheduledDays.length > 0 ||
        input.participantLimit !== undefined
      ) {
        throw new BadRequestException({
          code: 'FRIEND_CHALLENGE_FIELDS_INVALID',
          message:
            'Private friend challenges cannot publish regional schedule, location, or capacity fields.',
        });
      }
    } else {
      if (
        !input.regionCode ||
        !locationName ||
        !input.scheduledTime ||
        input.scheduledDays.length === 0
      ) {
        throw new BadRequestException({
          code: 'REGIONAL_CHALLENGE_SCHEDULE_REQUIRED',
          message:
            'Regional challenges require a region, location, local time, and at least one scheduled day.',
        });
      }
      if (
        invitedFriendUserIds.length > 0 ||
        invitedContacts.length > 0 ||
        input.timezone
      ) {
        throw new BadRequestException({
          code: 'REGIONAL_CHALLENGE_INVITATIONS_INVALID',
          message:
            'Regional challenges use local discovery and cannot include private invitations or a caller-selected timezone.',
        });
      }
    }

    return this.idempotency.execute<SocialChallengeJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: {
          ...input,
          activityLabel,
          description,
          invitedContacts,
          invitedFriendUserIds,
          locationName,
          name,
        },
        responseCode: 201,
        scope: 'social:challenges:create',
        storeResponseBody: invitedContacts.length === 0,
      },
      async (transaction) => {
        const { user } = await this.ensureIdentity(principal, transaction);
        const creationKeyHash = socialInvitationHash(
          `${user.id}:${idempotencyKey}`,
        );
        const region =
          input.challengeType === 'regional'
            ? await this.resolveApprovedRegionPolicy(
                transaction,
                user.id,
                input.regionCode ?? '',
              )
            : null;
        const timezone =
          region?.timezone ?? this.requireChallengeTimezone(input.timezone);
        this.assertChallengeStartsFromCurrentDate(
          input.startDate,
          timezone,
          new Date(),
        );
        if (invitedFriendUserIds.length > 0) {
          await this.assertAcceptedFriends(
            transaction,
            user.id,
            invitedFriendUserIds,
          );
        }
        const now = new Date();
        const existingChallenge = await transaction
          .selectFrom('social_challenges')
          .select('id')
          .where('creation_key_hash', '=', creationKeyHash)
          .executeTakeFirst();
        const challenge =
          existingChallenge ??
          (await transaction
            .insertInto('social_challenges')
            .values({
              activity: input.activity,
              activity_label: activityLabel,
              challenge_type: input.challengeType,
              creation_key_hash: creationKeyHash,
              created_at: now,
              description,
              end_date: input.endDate,
              location_name: locationName,
              name,
              owner_user_id: user.id,
              participant_limit: input.participantLimit ?? null,
              region_policy_id: region?.id ?? null,
              scheduled_days: [...input.scheduledDays].sort(
                (left, right) => left - right,
              ),
              scheduled_time_local: input.scheduledTime ?? null,
              start_date: input.startDate,
              status: 'active',
              target_count: input.targetCount,
              target_period: input.targetPeriod,
              timezone,
              updated_at: now,
            })
            .returning('id')
            .executeTakeFirstOrThrow());
        if (!existingChallenge) {
          await transaction
            .insertInto('social_challenge_members')
            .values({
              challenge_id: challenge.id,
              contact_invitation_id: null,
              created_at: now,
              invitation_source: 'owner',
              invited_by_user_id: user.id,
              responded_at: now,
              role: 'owner',
              status: 'accepted',
              updated_at: now,
              user_id: user.id,
            })
            .executeTakeFirstOrThrow();
          if (invitedFriendUserIds.length > 0) {
            await transaction
              .insertInto('social_challenge_members')
              .values(
                invitedFriendUserIds.map((friendUserId) => ({
                  challenge_id: challenge.id,
                  contact_invitation_id: null,
                  created_at: now,
                  invitation_source: 'friend' as const,
                  invited_by_user_id: user.id,
                  responded_at: null,
                  role: 'member' as const,
                  status: 'pending' as const,
                  updated_at: now,
                  user_id: friendUserId,
                })),
              )
              .execute();
          }
          await this.recordSocialRelationshipEvent(transaction, {
            action: 'challenge_created',
            actorUserId: user.id,
            metadata: {
              activity: input.activity,
              challengeId: challenge.id,
              challengeType: input.challengeType,
            },
            requestId: idempotencyKey,
            subjectUserId: null,
          });
          for (const friendUserId of invitedFriendUserIds) {
            await this.recordSocialRelationshipEvent(transaction, {
              action: 'challenge_friend_invited',
              actorUserId: user.id,
              metadata: { challengeId: challenge.id },
              requestId: idempotencyKey,
              subjectUserId: friendUserId,
            });
          }
        }
        const contactInvitations: ChallengeContactInvitationJson[] = [];
        for (const [index, contact] of invitedContacts.entries()) {
          const invitation = await this.createContactInvitation(
            transaction,
            challenge.id,
            user.id,
            contact,
            socialInvitationHash(`${user.id}:${idempotencyKey}:${index}`),
            now,
          );
          contactInvitations.push(invitation);
          await this.recordSocialRelationshipEvent(transaction, {
            action: 'challenge_contact_link_created',
            actorUserId: user.id,
            metadata: { challengeId: challenge.id, channel: contact.channel },
            requestId: socialInvitationHash(
              `${idempotencyKey}:contact:${index}`,
            ),
            subjectUserId: null,
          });
        }
        const created = await this.loadChallenges(
          transaction,
          user.id,
          challenge.id,
        );
        const response = created[0];
        if (!response) {
          throw new ConflictException({
            code: 'CHALLENGE_CREATION_INCOMPLETE',
            message: 'The challenge could not be created. Please retry.',
          });
        }
        return contactInvitations.length > 0
          ? { ...response, contactInvitations }
          : response;
      },
    );
  }

  inviteFriendToChallenge(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    challengeId: string,
    input: InviteChallengeFriendDto,
  ): Promise<ChallengeInvitationResponseDto> {
    return this.idempotency.execute<ChallengeInvitationJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { challengeId, friendUserId: input.friendUserId },
        responseCode: 201,
        scope: 'social:challenge-invitations:create',
      },
      async (transaction) => {
        const { user } = await this.ensureIdentity(principal, transaction);
        const challenge = await transaction
          .selectFrom('social_challenges')
          .select([
            'challenge_type',
            'end_date',
            'owner_user_id',
            'status',
            'timezone',
          ])
          .where('id', '=', challengeId)
          .executeTakeFirst();
        if (
          !challenge ||
          challenge.status !== 'active' ||
          challenge.challenge_type !== 'friend' ||
          normalizeDateKey(challenge.end_date) <
            dateKeyInTimezone(new Date(), challenge.timezone)
        ) {
          throw new NotFoundException({
            code: 'CHALLENGE_NOT_FOUND',
            message: 'That challenge is not available.',
          });
        }
        if (challenge.owner_user_id !== user.id) {
          throw new ForbiddenException({
            code: 'CHALLENGE_OWNER_REQUIRED',
            message: 'Only the challenge creator can invite friends.',
          });
        }
        await lockSocialPair(transaction, user.id, input.friendUserId);
        await requireSocialPairAvailable(
          transaction,
          user.id,
          input.friendUserId,
        );

        const [userA, userB] = this.canonicalPair(user.id, input.friendUserId);
        const friendship = await transaction
          .selectFrom('friendships')
          .select('user_a_id')
          .where('user_a_id', '=', userA)
          .where('user_b_id', '=', userB)
          .executeTakeFirst();
        if (!friendship) {
          throw new ForbiddenException({
            code: 'ACCEPTED_FRIEND_REQUIRED',
            message: 'Only accepted friends can be invited to a challenge.',
          });
        }

        const friend = await transaction
          .selectFrom('profiles')
          .innerJoin('users', 'users.id', 'profiles.user_id')
          .select('profiles.user_id')
          .where('profiles.user_id', '=', input.friendUserId)
          .where('users.status', '=', 'active')
          .executeTakeFirst();
        if (!friend) {
          throw new NotFoundException({
            code: 'USER_NOT_FOUND',
            message: 'That friend is not available.',
          });
        }

        const existing = await transaction
          .selectFrom('social_challenge_members')
          .select(['role', 'status'])
          .where('challenge_id', '=', challengeId)
          .where('user_id', '=', input.friendUserId)
          .forUpdate()
          .executeTakeFirst();
        if (existing?.status === 'accepted') {
          throw new ConflictException({
            code: 'CHALLENGE_MEMBER_ALREADY_ACCEPTED',
            message: 'That friend is already in this challenge.',
          });
        }
        if (existing?.status === 'pending') {
          return {
            challengeId,
            status: 'pending',
          };
        }

        const now = new Date();
        if (existing) {
          await transaction
            .updateTable('social_challenge_members')
            .set({
              contact_invitation_id: null,
              invitation_source: 'friend',
              invited_by_user_id: user.id,
              responded_at: null,
              role: 'member',
              status: 'pending',
              updated_at: now,
            })
            .where('challenge_id', '=', challengeId)
            .where('user_id', '=', input.friendUserId)
            .executeTakeFirstOrThrow();
        } else {
          const inserted = await transaction
            .insertInto('social_challenge_members')
            .values({
              challenge_id: challengeId,
              contact_invitation_id: null,
              created_at: now,
              invitation_source: 'friend',
              invited_by_user_id: user.id,
              responded_at: null,
              role: 'member',
              status: 'pending',
              updated_at: now,
              user_id: input.friendUserId,
            })
            .onConflict((conflict) =>
              conflict.columns(['challenge_id', 'user_id']).doNothing(),
            )
            .returning('status')
            .executeTakeFirst();
          if (!inserted) {
            const concurrent = await transaction
              .selectFrom('social_challenge_members')
              .select('status')
              .where('challenge_id', '=', challengeId)
              .where('user_id', '=', input.friendUserId)
              .executeTakeFirstOrThrow();
            if (concurrent.status === 'accepted') {
              throw new ConflictException({
                code: 'CHALLENGE_MEMBER_ALREADY_ACCEPTED',
                message: 'That friend is already in this challenge.',
              });
            }
          }
        }
        await this.recordSocialRelationshipEvent(transaction, {
          action: 'challenge_friend_invited',
          actorUserId: user.id,
          metadata: { challengeId },
          requestId: idempotencyKey,
          subjectUserId: input.friendUserId,
        });
        return {
          challengeId,
          status: 'pending',
        };
      },
    );
  }

  inviteContactToChallenge(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    challengeId: string,
    input: InviteChallengeContactDto,
  ): Promise<ChallengeContactInvitationResponseDto> {
    const destination = normalizeContactDestination(
      input.channel,
      input.destination,
    );
    return this.idempotency.execute<ChallengeContactInvitationJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { challengeId, channel: input.channel, destination },
        responseCode: 201,
        scope: 'social:challenge-contact-invitations:create',
        storeResponseBody: false,
      },
      async (transaction) => {
        const { user } = await this.ensureIdentity(principal, transaction);
        const challenge = await transaction
          .selectFrom('social_challenges')
          .select([
            'challenge_type',
            'end_date',
            'owner_user_id',
            'status',
            'timezone',
          ])
          .where('id', '=', challengeId)
          .executeTakeFirst();
        if (
          !challenge ||
          challenge.status !== 'active' ||
          normalizeDateKey(challenge.end_date) <
            dateKeyInTimezone(new Date(), challenge.timezone)
        ) {
          throw new NotFoundException({
            code: 'CHALLENGE_NOT_FOUND',
            message: 'That challenge is not available.',
          });
        }
        if (challenge.owner_user_id !== user.id) {
          throw new ForbiddenException({
            code: 'CHALLENGE_OWNER_REQUIRED',
            message: 'Only the challenge creator can send contact invitations.',
          });
        }
        if (challenge.challenge_type !== 'friend') {
          throw new BadRequestException({
            code: 'CONTACT_INVITE_FRIEND_CHALLENGE_ONLY',
            message:
              'Email and phone invitations are for private friend challenges.',
          });
        }

        const creationKeyHash = socialInvitationHash(
          `${user.id}:${idempotencyKey}`,
        );
        const now = new Date();
        const invitation = await this.createContactInvitation(
          transaction,
          challengeId,
          user.id,
          { channel: input.channel, destination },
          creationKeyHash,
          now,
        );
        await this.recordSocialRelationshipEvent(transaction, {
          action: 'challenge_contact_link_created',
          actorUserId: user.id,
          metadata: { challengeId, channel: input.channel },
          requestId: idempotencyKey,
          subjectUserId: null,
        });
        return invitation;
      },
    );
  }

  async inspectContactInvitation(
    principal: AuthenticatedPrincipal,
    token: string,
  ): Promise<ChallengeContactInvitationPreviewDto> {
    const tokenHash = socialInvitationHash(token.trim());
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const { user } = await this.ensureIdentity(principal, transaction);
        const invitation = await transaction
          .selectFrom('challenge_contact_invitations as invitation')
          .innerJoin(
            'social_challenges as challenge',
            'challenge.id',
            'invitation.challenge_id',
          )
          .innerJoin(
            'profiles as owner_profile',
            'owner_profile.user_id',
            'challenge.owner_user_id',
          )
          .select([
            'challenge.end_date',
            'challenge.name as challenge_name',
            'challenge.owner_user_id',
            'challenge.status as challenge_status',
            'challenge.timezone',
            'invitation.channel',
            'invitation.destination_hint',
            'invitation.expires_at',
            'invitation.status',
            'owner_profile.screen_name as owner_screen_name',
          ])
          .where('invitation.invite_token_hash', '=', tokenHash)
          .executeTakeFirst();
        if (
          !invitation ||
          invitation.challenge_status !== 'active' ||
          normalizeDateKey(invitation.end_date) <
            dateKeyInTimezone(new Date(), invitation.timezone) ||
          invitation.status !== 'pending' ||
          invitation.expires_at <= new Date()
        ) {
          throw new NotFoundException({
            code: 'CHALLENGE_CONTACT_INVITATION_NOT_FOUND',
            message: 'That challenge invitation is not available.',
          });
        }
        await requireSocialPairAvailable(
          transaction,
          invitation.owner_user_id,
          user.id,
        );
        return {
          channel: invitation.channel,
          challengeName: invitation.challenge_name,
          destinationHint: invitation.destination_hint,
          expiresAt: invitation.expires_at.toISOString(),
          ownerScreenName: invitation.owner_screen_name,
        };
      });
  }

  redeemContactInvitation(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    token: string,
    suppliedDestination?: string,
  ): Promise<ChallengeInvitationResponseDto> {
    const normalizedToken = token.trim();
    const tokenHash = socialInvitationHash(normalizedToken);
    return this.idempotency.execute<ChallengeInvitationJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { tokenHash },
        responseCode: 201,
        scope: 'social:challenge-contact-invitations:redeem',
      },
      async (transaction) => {
        const { user } = await this.ensureIdentity(principal, transaction);
        const invitation = await transaction
          .selectFrom('challenge_contact_invitations as invitation')
          .innerJoin(
            'social_challenges as challenge',
            'challenge.id',
            'invitation.challenge_id',
          )
          .select([
            'challenge.id as challenge_id',
            'challenge.end_date',
            'challenge.owner_user_id',
            'challenge.status as challenge_status',
            'challenge.timezone',
            'invitation.expires_at',
            'invitation.channel',
            'invitation.destination_hash',
            'invitation.id',
            'invitation.status',
          ])
          .where('invitation.invite_token_hash', '=', tokenHash)
          .forUpdate()
          .executeTakeFirst();
        if (
          !invitation ||
          invitation.challenge_status !== 'active' ||
          normalizeDateKey(invitation.end_date) <
            dateKeyInTimezone(new Date(), invitation.timezone)
        ) {
          throw new NotFoundException({
            code: 'CHALLENGE_CONTACT_INVITATION_NOT_FOUND',
            message: 'That challenge invitation is not available.',
          });
        }
        const now = new Date();
        if (invitation.expires_at <= now) {
          throw new ConflictException({
            code: 'CHALLENGE_CONTACT_INVITATION_EXPIRED',
            message: 'That challenge invitation has expired.',
          });
        }
        if (invitation.status !== 'pending') {
          throw new ConflictException({
            code: 'CHALLENGE_CONTACT_INVITATION_RESOLVED',
            message:
              'That challenge invitation has already been used or revoked.',
          });
        }
        const destinationHash = requireInvitationDestinationHash(
          principal,
          invitation.channel,
          normalizedToken,
          suppliedDestination,
        );
        if (destinationHash !== invitation.destination_hash) {
          throw new NotFoundException({
            code: 'CHALLENGE_CONTACT_INVITATION_NOT_FOUND',
            message: 'That challenge invitation is not available.',
          });
        }
        if (invitation.owner_user_id === user.id) {
          throw new BadRequestException({
            code: 'CHALLENGE_OWNER_ALREADY_JOINED',
            message: 'You already own this challenge.',
          });
        }
        await lockSocialPair(transaction, invitation.owner_user_id, user.id);
        await requireSocialPairAvailable(
          transaction,
          invitation.owner_user_id,
          user.id,
        );
        const existingMembership = await transaction
          .selectFrom('social_challenge_members')
          .select('status')
          .where('challenge_id', '=', invitation.challenge_id)
          .where('user_id', '=', user.id)
          .executeTakeFirst();
        if (existingMembership?.status === 'accepted') {
          throw new ConflictException({
            code: 'CHALLENGE_MEMBER_ALREADY_ACCEPTED',
            message: 'You already joined this challenge.',
          });
        }
        await transaction
          .updateTable('challenge_contact_invitations')
          .set({
            claimed_at: now,
            claimed_by_user_id: user.id,
            status: 'claimed',
          })
          .where('id', '=', invitation.id)
          .executeTakeFirstOrThrow();
        await transaction
          .insertInto('social_challenge_members')
          .values({
            challenge_id: invitation.challenge_id,
            contact_invitation_id: invitation.id,
            created_at: now,
            invitation_source: 'contact',
            invited_by_user_id: invitation.owner_user_id,
            responded_at: now,
            role: 'member',
            status: 'accepted',
            updated_at: now,
            user_id: user.id,
          })
          .onConflict((conflict) =>
            conflict.columns(['challenge_id', 'user_id']).doUpdateSet({
              contact_invitation_id: invitation.id,
              invitation_source: 'contact',
              invited_by_user_id: invitation.owner_user_id,
              responded_at: now,
              role: 'member',
              status: 'accepted',
              updated_at: now,
            }),
          )
          .execute();
        await this.recordSocialRelationshipEvent(transaction, {
          action: 'challenge_contact_link_redeemed',
          actorUserId: user.id,
          metadata: { challengeId: invitation.challenge_id },
          requestId: idempotencyKey,
          subjectUserId: invitation.owner_user_id,
        });
        return {
          challengeId: invitation.challenge_id,
          status: 'accepted',
        };
      },
    );
  }

  joinRegionalChallenge(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    challengeId: string,
  ): Promise<ChallengeInvitationResponseDto> {
    return this.idempotency.execute<ChallengeInvitationJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { challengeId },
        responseCode: 201,
        scope: 'social:regional-challenges:join',
      },
      async (transaction) => {
        const { user } = await this.ensureIdentity(principal, transaction);
        const challenge = await transaction
          .selectFrom('social_challenges as challenge')
          .leftJoin(
            'region_policies as region',
            'region.id',
            'challenge.region_policy_id',
          )
          .select([
            'challenge.challenge_type',
            'challenge.end_date',
            'challenge.owner_user_id',
            'challenge.participant_limit',
            'challenge.region_policy_id',
            'challenge.status',
            'challenge.timezone',
          ])
          .where('challenge.id', '=', challengeId)
          .forUpdate('challenge')
          .executeTakeFirst();
        if (
          !challenge ||
          challenge.challenge_type !== 'regional' ||
          challenge.status !== 'active'
        ) {
          throw new NotFoundException({
            code: 'REGIONAL_CHALLENGE_NOT_FOUND',
            message: 'That regional challenge is not available.',
          });
        }
        await lockSocialPair(transaction, user.id, challenge.owner_user_id);
        await requireSocialPairAvailable(
          transaction,
          user.id,
          challenge.owner_user_id,
        );
        if (!challenge.region_policy_id) {
          throw new NotFoundException({
            code: 'REGIONAL_CHALLENGE_NOT_FOUND',
            message: 'That regional challenge is not available.',
          });
        }
        await this.requireCurrentRegionVerification(
          transaction,
          user.id,
          challenge.region_policy_id,
        );
        if (
          normalizeDateKey(challenge.end_date) <
          dateKeyInTimezone(new Date(), challenge.timezone)
        ) {
          throw new ConflictException({
            code: 'REGIONAL_CHALLENGE_ENDED',
            message: 'That regional challenge has already ended.',
          });
        }
        const existing = await transaction
          .selectFrom('social_challenge_members')
          .select('status')
          .where('challenge_id', '=', challengeId)
          .where('user_id', '=', user.id)
          .executeTakeFirst();
        if (existing?.status === 'accepted') {
          return { challengeId, status: 'accepted' };
        }
        if (challenge.participant_limit) {
          const memberCount = await transaction
            .selectFrom('social_challenge_members')
            .select(({ fn }) => fn.countAll<number>().as('count'))
            .where('challenge_id', '=', challengeId)
            .where('status', '=', 'accepted')
            .executeTakeFirstOrThrow();
          if (Number(memberCount.count) >= challenge.participant_limit) {
            throw new ConflictException({
              code: 'REGIONAL_CHALLENGE_FULL',
              message:
                'That regional challenge has reached its participant limit.',
            });
          }
        }
        const now = new Date();
        if (existing) {
          await transaction
            .updateTable('social_challenge_members')
            .set({
              contact_invitation_id: null,
              invitation_source: 'regional',
              invited_by_user_id: challenge.owner_user_id,
              responded_at: now,
              role: 'member',
              status: 'accepted',
              updated_at: now,
            })
            .where('challenge_id', '=', challengeId)
            .where('user_id', '=', user.id)
            .executeTakeFirstOrThrow();
        } else {
          await transaction
            .insertInto('social_challenge_members')
            .values({
              challenge_id: challengeId,
              contact_invitation_id: null,
              created_at: now,
              invitation_source: 'regional',
              invited_by_user_id: challenge.owner_user_id,
              responded_at: now,
              role: 'member',
              status: 'accepted',
              updated_at: now,
              user_id: user.id,
            })
            .executeTakeFirstOrThrow();
        }
        await this.recordSocialRelationshipEvent(transaction, {
          action: 'challenge_regional_joined',
          actorUserId: user.id,
          metadata: { challengeId },
          requestId: idempotencyKey,
          subjectUserId: challenge.owner_user_id,
        });
        return { challengeId, status: 'accepted' };
      },
    );
  }

  checkInToChallenge(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    challengeId: string,
  ): Promise<ChallengeCheckInResponseDto> {
    return this.idempotency.execute<ChallengeCheckInJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { challengeId },
        responseCode: 201,
        scope: 'social:challenges:check-in',
      },
      async (transaction) => {
        const { user } = await this.ensureIdentity(principal, transaction);
        const challenge = await transaction
          .selectFrom('social_challenges as challenge')
          .leftJoin(
            'region_policies as region',
            'region.id',
            'challenge.region_policy_id',
          )
          .select([
            'challenge.activity',
            'challenge.end_date',
            'challenge.scheduled_days',
            'challenge.start_date',
            'challenge.status',
            'challenge.timezone',
          ])
          .where('challenge.id', '=', challengeId)
          .executeTakeFirst();
        const membership = await transaction
          .selectFrom('social_challenge_members')
          .select('status')
          .where('challenge_id', '=', challengeId)
          .where('user_id', '=', user.id)
          .executeTakeFirst();
        if (
          !challenge ||
          challenge.status !== 'active' ||
          membership?.status !== 'accepted'
        ) {
          throw new ForbiddenException({
            code: 'CHALLENGE_MEMBERSHIP_REQUIRED',
            message: 'Join or accept this challenge before checking in.',
          });
        }
        const now = new Date();
        const eligibleDate = dateKeyInTimezone(now, challenge.timezone);
        if (
          eligibleDate < normalizeDateKey(challenge.start_date) ||
          eligibleDate > normalizeDateKey(challenge.end_date)
        ) {
          throw new ConflictException({
            code: 'CHALLENGE_NOT_IN_PROGRESS',
            message:
              'Check-ins are only available during the challenge window.',
          });
        }
        if (
          challenge.scheduled_days.length > 0 &&
          !challenge.scheduled_days.includes(
            this.weekdayForDateKey(eligibleDate),
          )
        ) {
          throw new ConflictException({
            code: 'CHALLENGE_NOT_SCHEDULED_TODAY',
            message: 'This challenge is not scheduled for today.',
          });
        }
        const verifiedWorkout =
          challenge.activity === 'gym'
            ? await transaction
                .selectFrom('workout_sessions')
                .select('id')
                .where('user_id', '=', user.id)
                .where('eligible_date', '=', eligibleDate)
                .where('status', '=', 'verified')
                .executeTakeFirst()
            : null;
        if (challenge.activity === 'gym' && !verifiedWorkout) {
          throw new ConflictException({
            code: 'VERIFIED_WORKOUT_REQUIRED',
            message:
              'Gym challenge progress updates automatically after a verified workout.',
          });
        }
        const source = verifiedWorkout ? 'verified_workout' : 'manual';
        const inserted = await transaction
          .insertInto('social_challenge_checkins')
          .values({
            challenge_id: challengeId,
            created_at: now,
            eligible_date: eligibleDate,
            source,
            user_id: user.id,
            workout_session_id: verifiedWorkout?.id ?? null,
          })
          .onConflict((conflict) =>
            conflict
              .columns(['challenge_id', 'user_id', 'eligible_date'])
              .doNothing(),
          )
          .returning(['id', 'source'])
          .executeTakeFirst();
        const checkIn =
          inserted ??
          (await transaction
            .selectFrom('social_challenge_checkins')
            .select(['id', 'source'])
            .where('challenge_id', '=', challengeId)
            .where('user_id', '=', user.id)
            .where('eligible_date', '=', eligibleDate)
            .executeTakeFirstOrThrow());
        if (inserted) {
          await this.recordSocialRelationshipEvent(transaction, {
            action: 'challenge_checkin_recorded',
            actorUserId: user.id,
            metadata: { challengeId, eligibleDate, source },
            requestId: idempotencyKey,
            subjectUserId: null,
          });
        }
        return {
          challengeId,
          checkInId: checkIn.id,
          eligibleDate,
          source: checkIn.source,
        };
      },
    );
  }

  respondToChallengeInvitation(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    challengeId: string,
    input: ChallengeInvitationDecisionDto,
  ): Promise<ChallengeInvitationResponseDto> {
    return this.idempotency.execute<ChallengeInvitationJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { challengeId, decision: input.decision },
        scope: 'social:challenge-invitations:respond',
      },
      async (transaction) => {
        const { user } = await this.ensureIdentity(principal, transaction);
        const membershipIdentity = await transaction
          .selectFrom('social_challenge_members')
          .select(['role', 'status'])
          .where('challenge_id', '=', challengeId)
          .where('user_id', '=', user.id)
          .executeTakeFirst();
        if (!membershipIdentity || membershipIdentity.role !== 'member') {
          throw new NotFoundException({
            code: 'CHALLENGE_INVITATION_NOT_FOUND',
            message: 'That challenge invitation was not found.',
          });
        }
        const challengeOwner = await transaction
          .selectFrom('social_challenges')
          .select(['end_date', 'owner_user_id', 'status', 'timezone'])
          .where('id', '=', challengeId)
          .executeTakeFirst();
        if (
          !challengeOwner ||
          challengeOwner.status !== 'active' ||
          normalizeDateKey(challengeOwner.end_date) <
            dateKeyInTimezone(new Date(), challengeOwner.timezone)
        ) {
          throw new NotFoundException({
            code: 'CHALLENGE_INVITATION_NOT_FOUND',
            message: 'That challenge invitation was not found.',
          });
        }
        await lockSocialPair(
          transaction,
          user.id,
          challengeOwner.owner_user_id,
        );
        const membership = await transaction
          .selectFrom('social_challenge_members')
          .select(['role', 'status'])
          .where('challenge_id', '=', challengeId)
          .where('user_id', '=', user.id)
          .forUpdate()
          .executeTakeFirst();
        if (!membership || membership.role !== 'member') {
          throw new NotFoundException({
            code: 'CHALLENGE_INVITATION_NOT_FOUND',
            message: 'That challenge invitation was not found.',
          });
        }
        await requireSocialPairAvailable(
          transaction,
          user.id,
          challengeOwner.owner_user_id,
        );
        if (membership.status !== 'pending') {
          throw new ConflictException({
            code: 'CHALLENGE_INVITATION_ALREADY_DECIDED',
            message: 'That challenge invitation has already been decided.',
          });
        }

        await transaction
          .updateTable('social_challenge_members')
          .set({
            responded_at: new Date(),
            status: input.decision,
            updated_at: new Date(),
          })
          .where('challenge_id', '=', challengeId)
          .where('user_id', '=', user.id)
          .executeTakeFirstOrThrow();
        await this.recordSocialRelationshipEvent(transaction, {
          action:
            input.decision === 'accepted'
              ? 'challenge_invitation_accepted'
              : 'challenge_invitation_declined',
          actorUserId: user.id,
          metadata: { challengeId },
          requestId: idempotencyKey,
          subjectUserId: challengeOwner.owner_user_id,
        });
        return {
          challengeId,
          status: input.decision,
        };
      },
    );
  }

  cancelChallenge(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    challengeId: string,
  ): Promise<ChallengeCancellationJson> {
    return this.idempotency.execute<ChallengeCancellationJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { challengeId },
        scope: 'social:challenges:cancel',
      },
      async (transaction) => {
        const { user } = await this.ensureIdentity(principal, transaction);
        const challenge = await transaction
          .selectFrom('social_challenges')
          .select(['end_date', 'owner_user_id', 'status', 'timezone'])
          .where('id', '=', challengeId)
          .forUpdate()
          .executeTakeFirst();
        if (!challenge || challenge.owner_user_id !== user.id) {
          throw new NotFoundException({
            code: 'CHALLENGE_NOT_FOUND',
            message: 'That challenge is not available.',
          });
        }
        if (challenge.status === 'cancelled') {
          return { challengeId, state: 'cancelled' };
        }
        if (
          challenge.status !== 'active' ||
          normalizeDateKey(challenge.end_date) <
            dateKeyInTimezone(new Date(), challenge.timezone)
        ) {
          throw new ConflictException({
            code: 'CHALLENGE_ALREADY_ENDED',
            message: 'An ended challenge cannot be cancelled.',
          });
        }
        const now = new Date();
        await transaction
          .updateTable('social_challenges')
          .set({ status: 'cancelled', updated_at: now })
          .where('id', '=', challengeId)
          .executeTakeFirstOrThrow();
        await transaction
          .updateTable('challenge_contact_invitations')
          .set({ status: 'revoked' })
          .where('challenge_id', '=', challengeId)
          .where('status', '=', 'pending')
          .execute();
        await this.recordSocialRelationshipEvent(transaction, {
          action: 'challenge_cancelled',
          actorUserId: user.id,
          metadata: { challengeId },
          requestId: idempotencyKey,
          subjectUserId: null,
        });
        return { challengeId, state: 'cancelled' };
      },
    );
  }

  withdrawFromChallenge(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    challengeId: string,
  ): Promise<ChallengeInvitationResponseDto> {
    return this.idempotency.execute<ChallengeInvitationJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { challengeId },
        scope: 'social:challenges:withdraw',
      },
      async (transaction) => {
        const { user } = await this.ensureIdentity(principal, transaction);
        const membership = await transaction
          .selectFrom('social_challenge_members as membership')
          .innerJoin(
            'social_challenges as challenge',
            'challenge.id',
            'membership.challenge_id',
          )
          .select([
            'challenge.owner_user_id',
            'challenge.status as challenge_status',
            'membership.role',
            'membership.status',
          ])
          .where('membership.challenge_id', '=', challengeId)
          .where('membership.user_id', '=', user.id)
          .forUpdate('membership')
          .executeTakeFirst();
        if (!membership) {
          throw new NotFoundException({
            code: 'CHALLENGE_MEMBERSHIP_NOT_FOUND',
            message: 'That challenge membership is not available.',
          });
        }
        if (membership.role === 'owner') {
          throw new ConflictException({
            code: 'CHALLENGE_OWNER_CANNOT_WITHDRAW',
            message: 'Challenge creators can cancel, but cannot withdraw.',
          });
        }
        if (membership.status === 'withdrawn') {
          return { challengeId, status: 'withdrawn' };
        }
        if (
          membership.status !== 'accepted' ||
          membership.challenge_status !== 'active'
        ) {
          throw new ConflictException({
            code: 'CHALLENGE_WITHDRAWAL_UNAVAILABLE',
            message: 'That challenge membership cannot be withdrawn.',
          });
        }
        const now = new Date();
        await transaction
          .updateTable('social_challenge_members')
          .set({ responded_at: now, status: 'withdrawn', updated_at: now })
          .where('challenge_id', '=', challengeId)
          .where('user_id', '=', user.id)
          .executeTakeFirstOrThrow();
        await this.recordSocialRelationshipEvent(transaction, {
          action: 'challenge_member_withdrawn',
          actorUserId: user.id,
          metadata: { challengeId },
          requestId: idempotencyKey,
          subjectUserId: membership.owner_user_id,
        });
        return { challengeId, status: 'withdrawn' };
      },
    );
  }

  private async ensureIdentity(
    principal: AuthenticatedPrincipal,
    executor: DatabaseExecutor,
  ): Promise<{
    profile: Selectable<ProfilesTable>;
    user: Selectable<UsersTable>;
  }> {
    const user = await this.profiles.ensureUser(principal, executor);
    const profile = await this.profiles.ensureProfile(user.id, executor);
    return { profile, user };
  }

  private async removeBlockedPairState(
    transaction: Transaction<Database>,
    blockerUserId: string,
    blockedUserId: string,
    now: Date,
  ): Promise<void> {
    await transaction
      .updateTable('friend_requests')
      .set({ responded_at: now, status: 'cancelled', updated_at: now })
      .where('status', '=', 'pending')
      .where((expression) =>
        expression.or([
          expression.and([
            expression('requester_user_id', '=', blockerUserId),
            expression('recipient_user_id', '=', blockedUserId),
          ]),
          expression.and([
            expression('requester_user_id', '=', blockedUserId),
            expression('recipient_user_id', '=', blockerUserId),
          ]),
        ]),
      )
      .execute();

    const [userA, userB] = this.canonicalPair(blockerUserId, blockedUserId);
    await transaction
      .deleteFrom('friendships')
      .where('user_a_id', '=', userA)
      .where('user_b_id', '=', userB)
      .execute();

    const ownedChallenges = await transaction
      .selectFrom('social_challenges')
      .select(['id', 'owner_user_id'])
      .where('owner_user_id', 'in', [blockerUserId, blockedUserId])
      .execute();
    const blockerOwnedChallengeIds = ownedChallenges
      .filter((challenge) => challenge.owner_user_id === blockerUserId)
      .map((challenge) => challenge.id);
    const blockedOwnedChallengeIds = ownedChallenges
      .filter((challenge) => challenge.owner_user_id === blockedUserId)
      .map((challenge) => challenge.id);
    if (blockerOwnedChallengeIds.length > 0) {
      await transaction
        .updateTable('social_challenge_members')
        .set({ responded_at: now, status: 'withdrawn', updated_at: now })
        .where('challenge_id', 'in', blockerOwnedChallengeIds)
        .where('user_id', '=', blockedUserId)
        .where('role', '=', 'member')
        .where('status', 'in', ['accepted', 'pending'])
        .execute();
    }
    if (blockedOwnedChallengeIds.length > 0) {
      await transaction
        .updateTable('social_challenge_members')
        .set({ responded_at: now, status: 'withdrawn', updated_at: now })
        .where('challenge_id', 'in', blockedOwnedChallengeIds)
        .where('user_id', '=', blockerUserId)
        .where('role', '=', 'member')
        .where('status', 'in', ['accepted', 'pending'])
        .execute();
    }

    await this.closeWeeklyChallengePairState(
      transaction,
      blockerUserId,
      blockedUserId,
      now,
      'member_blocked',
    );
  }

  private async closeWeeklyChallengePairState(
    transaction: Transaction<Database>,
    leftUserId: string,
    rightUserId: string,
    now: Date,
    reason: 'friendship_removed' | 'member_blocked',
  ): Promise<void> {
    await transaction
      .updateTable('weekly_challenge_requests')
      .set({
        cancellation_reason: reason,
        responded_at: now,
        status: 'cancelled',
      })
      .where('status', 'in', ['accepted', 'pending'])
      .where((expression) =>
        expression.or([
          expression.and([
            expression('requester_user_id', '=', leftUserId),
            expression('recipient_user_id', '=', rightUserId),
          ]),
          expression.and([
            expression('requester_user_id', '=', rightUserId),
            expression('recipient_user_id', '=', leftUserId),
          ]),
        ]),
      )
      .execute();

    await transaction
      .updateTable('competition_matches')
      .set({
        outcome: { reason },
        settled_at: now,
        status: 'cancelled',
      })
      .where('status', '=', 'matched')
      .where((expression) =>
        expression.or([
          expression.and([
            expression('user_a_id', '=', leftUserId),
            expression('user_b_id', '=', rightUserId),
          ]),
          expression.and([
            expression('user_a_id', '=', rightUserId),
            expression('user_b_id', '=', leftUserId),
          ]),
        ]),
      )
      .execute();
  }

  private recordSocialRelationshipEvent(
    transaction: Transaction<Database>,
    event: {
      action: SocialRelationshipEventAction;
      actorUserId: string;
      metadata?: JsonObject;
      requestId: string;
      subjectUserId: string | null;
    },
  ): Promise<unknown> {
    return transaction
      .insertInto('social_relationship_events')
      .values({
        action: event.action,
        actor_user_id: event.actorUserId,
        created_at: new Date(),
        metadata: event.metadata ?? {},
        request_id: event.requestId,
        subject_user_id: event.subjectUserId,
      })
      .onConflict((conflict) =>
        conflict
          .columns(['actor_user_id', 'action', 'request_id', 'subject_user_id'])
          .doNothing(),
      )
      .executeTakeFirst();
  }

  private async loadSocialUsers(
    executor: DatabaseExecutor,
    userIds: string[],
  ): Promise<Map<string, SocialUserJson>> {
    if (userIds.length === 0) {
      return new Map();
    }
    const uniqueUserIds = [...new Set(userIds)];
    const profiles = await executor
      .selectFrom('profiles')
      .select(['screen_name', 'user_id'])
      .where('user_id', 'in', uniqueUserIds)
      .execute();
    const streaksByUser = await loadPublicStreaks(executor, uniqueUserIds);
    return new Map(
      profiles.map((profile) => [
        profile.user_id,
        {
          screenName: profile.screen_name,
          streaks: this.toStreaksJson(streaksByUser.get(profile.user_id)),
          userId: profile.user_id,
        },
      ]),
    );
  }

  private emptyStreaks(): StreakCountsJson {
    return {
      daily: 0,
      monthly: 0,
      projectionVersion: 'streaks-v1',
      weekly: 0,
      yearly: 0,
    };
  }

  private toStreaksJson(streaks?: StreakCounts): StreakCountsJson {
    return streaks
      ? {
          daily: streaks.daily,
          monthly: streaks.monthly,
          projectionVersion: streaks.projectionVersion,
          weekly: streaks.weekly,
          yearly: streaks.yearly,
        }
      : this.emptyStreaks();
  }

  private async loadChallenges(
    executor: DatabaseExecutor,
    userId: string,
    challengeId?: string,
  ): Promise<SocialChallengeJson[]> {
    let membershipQuery = executor
      .selectFrom('social_challenge_members')
      .select(['challenge_id', 'role', 'status'])
      .where('user_id', '=', userId)
      .where('status', 'in', ['accepted', 'pending']);
    if (challengeId) {
      membershipQuery = membershipQuery.where('challenge_id', '=', challengeId);
    }
    const myMemberships = await membershipQuery.execute();
    const challengeIds = myMemberships.map(
      (membership) => membership.challenge_id,
    );
    if (challengeIds.length === 0) {
      return [];
    }

    return this.loadChallengeDetails(executor, userId, challengeIds);
  }

  private async loadChallengeDetails(
    executor: DatabaseExecutor,
    userId: string,
    challengeIds: string[],
  ): Promise<SocialChallengeJson[]> {
    if (challengeIds.length === 0) {
      return [];
    }

    const challenges = await executor
      .selectFrom('social_challenges as challenge')
      .leftJoin(
        'region_policies as region',
        'region.id',
        'challenge.region_policy_id',
      )
      .select([
        'challenge.activity',
        'challenge.activity_label',
        'challenge.challenge_type',
        'challenge.created_at',
        'challenge.description',
        'challenge.end_date',
        'challenge.id',
        'challenge.location_name',
        'challenge.name',
        'challenge.owner_user_id',
        'challenge.participant_limit',
        'challenge.scheduled_days',
        'challenge.scheduled_time_local',
        'challenge.start_date',
        'challenge.status',
        'challenge.target_count',
        'challenge.target_period',
        'region.code as region_code',
        'region.metro_name as region_name',
        'challenge.timezone',
      ])
      .where('challenge.id', 'in', challengeIds)
      .orderBy('challenge.start_date')
      .orderBy('challenge.created_at', 'desc')
      .execute();
    const blockedUserIds = await loadBlockedUserIds(executor, userId);
    const visibleChallenges = challenges.filter(
      (challenge) => !blockedUserIds.has(challenge.owner_user_id),
    );
    const activityWindow = socialChallengeDateWindow(visibleChallenges);
    if (!activityWindow) {
      return [];
    }
    const activeChallengeIds = visibleChallenges.map(({ id }) => id);
    let memberQuery = executor
      .selectFrom('social_challenge_members')
      .innerJoin(
        'profiles',
        'profiles.user_id',
        'social_challenge_members.user_id',
      )
      .select([
        'social_challenge_members.challenge_id',
        'social_challenge_members.role',
        'social_challenge_members.status',
        'social_challenge_members.user_id',
        'profiles.screen_name',
      ])
      .where('social_challenge_members.challenge_id', 'in', activeChallengeIds)
      .where('social_challenge_members.status', 'in', ['accepted', 'pending'])
      .orderBy('social_challenge_members.created_at', 'asc');
    if (blockedUserIds.size > 0) {
      memberQuery = memberQuery.where(
        'social_challenge_members.user_id',
        'not in',
        [...blockedUserIds],
      );
    }
    const members = await memberQuery.execute();
    const checkIns = await executor
      .selectFrom('social_challenge_checkins')
      .select(['challenge_id', 'eligible_date', 'user_id'])
      .where('challenge_id', 'in', activeChallengeIds)
      .execute();
    const memberUserIds = [...new Set(members.map(({ user_id }) => user_id))];
    const verifiedWorkouts =
      memberUserIds.length === 0
        ? []
        : await executor
            .selectFrom('workout_sessions')
            .select(['eligible_date', 'user_id'])
            .distinct()
            .where('user_id', 'in', memberUserIds)
            .where('status', '=', 'verified')
            .where('eligible_date', '>=', activityWindow.startDate)
            .where('eligible_date', '<=', activityWindow.endDate)
            .execute();
    const streaksByUser = await loadPublicStreaks(executor, memberUserIds);
    const checkInDates = new Map<string, Set<string>>();
    for (const checkIn of checkIns) {
      const key = this.challengeMemberKey(
        checkIn.challenge_id,
        checkIn.user_id,
      );
      const dates = checkInDates.get(key) ?? new Set<string>();
      dates.add(normalizeDateKey(checkIn.eligible_date));
      checkInDates.set(key, dates);
    }
    const verifiedDatesByUser = new Map<string, Set<string>>();
    for (const workout of verifiedWorkouts) {
      const dates =
        verifiedDatesByUser.get(workout.user_id) ?? new Set<string>();
      dates.add(normalizeDateKey(workout.eligible_date));
      verifiedDatesByUser.set(workout.user_id, dates);
    }

    const serverNow = new Date();
    return visibleChallenges.flatMap((challenge) => {
      const startDate = normalizeDateKey(challenge.start_date);
      const endDate = normalizeDateKey(challenge.end_date);
      const targetTotal = this.challengeTargetTotal(
        startDate,
        endDate,
        challenge.target_count,
        challenge.target_period,
      );
      const internalChallengeMembers = members
        .filter((member) => member.challenge_id === challenge.id)
        .map((member) => {
          const dates = new Set(
            checkInDates.get(
              this.challengeMemberKey(challenge.id, member.user_id),
            ) ?? [],
          );
          if (challenge.activity === 'gym') {
            for (const date of verifiedDatesByUser.get(member.user_id) ?? []) {
              if (
                date >= startDate &&
                date <= endDate &&
                (challenge.scheduled_days.length === 0 ||
                  challenge.scheduled_days.includes(
                    this.weekdayForDateKey(date),
                  ))
              ) {
                dates.add(date);
              }
            }
          }
          const completedCount = dates.size;
          return {
            progress: {
              completedCount,
              completionPercent: Math.min(
                100,
                Math.round((completedCount / targetTotal) * 100),
              ),
              targetTotal,
            },
            role: member.role,
            screenName: member.screen_name,
            status: member.status as 'accepted' | 'pending',
            streaks: this.toStreaksJson(streaksByUser.get(member.user_id)),
            userId: member.user_id,
          };
        });
      const mine = internalChallengeMembers.find(
        (member) => member.userId === userId,
      );
      const owner = internalChallengeMembers.find(
        (member) => member.role === 'owner',
      );
      if (!owner) {
        return [];
      }
      const challengeMembers: ChallengeMemberJson[] =
        internalChallengeMembers.map((member) => ({
          progress: member.progress,
          role: member.role,
          screenName: member.screenName,
          status: member.status,
          streaks: member.streaks,
        }));
      const emptyProgress = {
        completedCount: 0,
        completionPercent: 0,
        targetTotal,
      };
      const participantCount = challengeMembers.filter(
        ({ status }) => status === 'accepted',
      ).length;
      const today = dateKeyInTimezone(serverNow, challenge.timezone);
      const lifecycleState =
        challenge.status === 'cancelled'
          ? 'cancelled'
          : challenge.status === 'archived' || endDate < today
            ? 'ended'
            : startDate > today
              ? 'upcoming'
              : 'active';
      const isFull =
        challenge.participant_limit !== null &&
        participantCount >= challenge.participant_limit;
      const state =
        (lifecycleState === 'active' || lifecycleState === 'upcoming') && isFull
          ? 'full'
          : lifecycleState;
      const scheduledToday =
        challenge.scheduled_days.length === 0 ||
        challenge.scheduled_days.includes(this.weekdayForDateKey(today));
      const isOpen =
        lifecycleState === 'active' || lifecycleState === 'upcoming';
      return [
        {
          activity: challenge.activity,
          activityLabel: challenge.activity_label,
          canCancel: mine?.role === 'owner' && isOpen,
          canCheckIn:
            mine?.status === 'accepted' &&
            lifecycleState === 'active' &&
            scheduledToday,
          canInvite:
            mine?.role === 'owner' &&
            challenge.challenge_type === 'friend' &&
            isOpen,
          canJoin:
            challenge.challenge_type === 'regional' &&
            !mine &&
            isOpen &&
            !isFull,
          canRespond: mine?.status === 'pending' && isOpen,
          canWithdraw:
            mine?.role === 'member' && mine.status === 'accepted' && isOpen,
          challengeType: challenge.challenge_type,
          contactInvitations: [],
          createdAt: challenge.created_at.toISOString(),
          description: challenge.description,
          endDate,
          id: challenge.id,
          locationName: challenge.location_name,
          members: challengeMembers,
          myProgress: mine?.progress ?? emptyProgress,
          myRole: mine?.role ?? null,
          myStatus:
            mine?.status === 'pending'
              ? 'pending'
              : mine?.status === 'accepted'
                ? 'accepted'
                : 'not_joined',
          name: challenge.name,
          ownerScreenName: owner.screenName,
          ownerStreaks: owner.streaks,
          participantCount,
          participantLimit: challenge.participant_limit,
          regionCode: challenge.region_code ?? null,
          regionName: challenge.region_name ?? null,
          scheduledDays: challenge.scheduled_days,
          scheduledTime: challenge.scheduled_time_local?.slice(0, 5) ?? null,
          serverTime: serverNow.toISOString(),
          startDate,
          state,
          targetCount: challenge.target_count,
          targetPeriod: challenge.target_period,
          timezone: challenge.timezone,
        },
      ];
    });
  }

  private async resolveApprovedRegionPolicy(
    executor: DatabaseExecutor,
    userId: string,
    regionCode: string,
  ) {
    const now = new Date();
    const region = await executor
      .selectFrom('region_policies')
      .select(['code', 'id', 'metro_name', 'timezone'])
      .where('code', '=', regionCode.trim().toLowerCase())
      .where('competition_enabled', '=', true)
      .where('deleted_at', 'is', null)
      .where('valid_from', '<=', now)
      .where((expression) =>
        expression.or([
          expression('valid_to', 'is', null),
          expression('valid_to', '>', now),
        ]),
      )
      .orderBy('valid_from', 'desc')
      .executeTakeFirst();
    if (!region) {
      throw new BadRequestException({
        code: 'CHALLENGE_REGION_UNAVAILABLE',
        message: 'Choose a supported GoGymGo region.',
      });
    }
    await this.requireCurrentRegionVerification(executor, userId, region.id);
    return region;
  }

  private async requireCurrentRegionVerification(
    executor: DatabaseExecutor,
    userId: string,
    regionPolicyId: string,
  ): Promise<void> {
    const now = new Date();
    const verification = await executor
      .selectFrom('region_verifications as verification')
      .innerJoin(
        'region_policies as policy',
        'policy.id',
        'verification.region_policy_id',
      )
      .select('verification.id')
      .where('verification.user_id', '=', userId)
      .where('verification.region_policy_id', '=', regionPolicyId)
      .where(currentRegionVerificationPredicate('verification', 'policy', now))
      .executeTakeFirst();
    if (!verification) {
      throw new UnprocessableEntityException({
        code: 'APPROVED_REGION_VERIFICATION_REQUIRED',
        message:
          'A current approved verification for this exact region is required.',
      });
    }
  }

  private requireChallengeTimezone(value: string | undefined): string {
    const timezone = value?.trim();
    if (!timezone) {
      throw new BadRequestException({
        code: 'CHALLENGE_TIMEZONE_REQUIRED',
        message: 'Choose the local timezone for this friend challenge.',
      });
    }
    try {
      new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format();
    } catch {
      throw new BadRequestException({
        code: 'CHALLENGE_TIMEZONE_INVALID',
        message: 'Choose a valid IANA timezone.',
      });
    }
    return timezone;
  }

  private assertChallengeStartsFromCurrentDate(
    startDate: string,
    timezone: string,
    now: Date,
  ): void {
    if (startDate < dateKeyInTimezone(now, timezone)) {
      throw new BadRequestException({
        code: 'CHALLENGE_START_DATE_PAST',
        message: 'A challenge cannot start before the current local date.',
      });
    }
  }

  private async createContactInvitation(
    transaction: Transaction<Database>,
    challengeId: string,
    inviterUserId: string,
    contact: { channel: 'email' | 'phone'; destination: string },
    creationKeyHash: string,
    now: Date,
  ): Promise<ChallengeContactInvitationJson> {
    // Opaque tokens are never stored in an idempotency response. A completed
    // retry rotates the old row so exactly one link for the creation key works.
    await transaction
      .deleteFrom('challenge_contact_invitations')
      .where('creation_key_hash', '=', creationKeyHash)
      .execute();

    const token = randomBytes(24).toString('base64url');
    const expiresAt = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1_000);
    const invitation = await transaction
      .insertInto('challenge_contact_invitations')
      .values({
        challenge_id: challengeId,
        channel: contact.channel,
        creation_key_hash: creationKeyHash,
        claimed_at: null,
        claimed_by_user_id: null,
        created_at: now,
        destination_hash: socialInvitationHash(
          `${token}:${contact.destination}`,
        ),
        destination_hint: contactDestinationHint(
          contact.channel,
          contact.destination,
        ),
        delivery_mode: 'link',
        expires_at: expiresAt,
        invite_token_hash: socialInvitationHash(token),
        inviter_user_id: inviterUserId,
        status: 'pending',
        token_version: 1,
      })
      .returning(['destination_hint', 'id'])
      .executeTakeFirstOrThrow();
    return {
      challengeId,
      channel: contact.channel,
      destinationHint: invitation.destination_hint,
      deliveryMode: 'link',
      deliveryStatus: 'not_sent',
      expiresAt: expiresAt.toISOString(),
      id: invitation.id,
      joinUrl: `https://gogymgo.com/join?challengeInvite=${encodeURIComponent(token)}`,
    };
  }

  private async assertAcceptedFriends(
    executor: DatabaseExecutor,
    userId: string,
    friendUserIds: string[],
  ): Promise<void> {
    if (friendUserIds.includes(userId)) {
      throw new BadRequestException({
        code: 'CHALLENGE_SELF_INVITE',
        message: 'You are already the challenge creator.',
      });
    }
    const sortedFriendUserIds = [...friendUserIds].sort();
    for (const friendUserId of sortedFriendUserIds) {
      await lockSocialPair(executor, userId, friendUserId);
    }
    const friendships = await executor
      .selectFrom('friendships')
      .select(['user_a_id', 'user_b_id'])
      .where((expression) =>
        expression.or([
          expression('user_a_id', '=', userId),
          expression('user_b_id', '=', userId),
        ]),
      )
      .execute();
    const acceptedFriendIds = new Set(
      friendships.map((friendship) =>
        friendship.user_a_id === userId
          ? friendship.user_b_id
          : friendship.user_a_id,
      ),
    );
    const unavailable = friendUserIds.find(
      (friendUserId) => !acceptedFriendIds.has(friendUserId),
    );
    if (unavailable) {
      throw new ForbiddenException({
        code: 'ACCEPTED_FRIEND_REQUIRED',
        message: 'Only accepted friends can be challenged.',
      });
    }
    const blockedUserIds = await loadBlockedUserIds(executor, userId);
    if (
      friendUserIds.some((friendUserId) => blockedUserIds.has(friendUserId))
    ) {
      throw new ForbiddenException({
        code: 'ACCEPTED_FRIEND_REQUIRED',
        message: 'Only accepted friends can be challenged.',
      });
    }
  }

  private assertChallengeWindow(
    startDateKey: string,
    endDateKey: string,
  ): void {
    const start = new Date(`${startDateKey}T00:00:00.000Z`);
    const end = new Date(`${endDateKey}T00:00:00.000Z`);
    const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(startDateKey) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(endDateKey) ||
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      start.toISOString().slice(0, 10) !== startDateKey ||
      end.toISOString().slice(0, 10) !== endDateKey ||
      days < 1 ||
      days > 31
    ) {
      throw new BadRequestException({
        code: 'CHALLENGE_WINDOW_INVALID',
        message: 'Choose a challenge window between 1 and 31 days.',
      });
    }
  }

  private challengeMemberKey(challengeId: string, userId: string): string {
    return `${challengeId}:${userId}`;
  }

  private challengeTargetTotal(
    startDateKey: string,
    endDateKey: string,
    targetCount: number,
    targetPeriod: 'monthly' | 'weekly',
  ): number {
    if (targetPeriod === 'monthly') {
      return targetCount;
    }
    const start = new Date(`${startDateKey}T00:00:00.000Z`);
    const end = new Date(`${endDateKey}T00:00:00.000Z`);
    const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    return targetCount * Math.max(1, Math.ceil(days / 7));
  }

  private weekdayForDateKey(dateKey: string): number {
    return new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
  }

  private canonicalPair(left: string, right: string): [string, string] {
    const normalizedLeft = left.toLowerCase();
    const normalizedRight = right.toLowerCase();
    return normalizedLeft < normalizedRight
      ? [normalizedLeft, normalizedRight]
      : [normalizedRight, normalizedLeft];
  }

  private isConstraintViolation(error: unknown, constraint: string): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505' &&
      'constraint' in error &&
      error.constraint === constraint
    );
  }
}
