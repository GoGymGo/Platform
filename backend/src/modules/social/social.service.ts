import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { sql } from 'kysely';
import type { Kysely, Selectable, Transaction } from 'kysely';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { normalizeDateKey } from '../../database/date-key';
import { DatabaseService } from '../../database/database.service';
import type {
  Database,
  JsonObject,
  ProfilesTable,
  SocialChallengeActivity,
  SocialChallengeMemberStatus,
  SocialChallengeTargetPeriod,
  SocialChallengeType,
  UsersTable,
} from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { dateKeyInTimezone } from '../competitions/competition-calendar';
import { ProfilesService } from '../profiles/profiles.service';
import { loadPublicStreaks } from '../streaks/public-streaks';
import type { StreakCounts } from '../streaks/streak-calculation';
import type {
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
  SearchUsersQueryDto,
  SocialChallengeResponseDto,
  SocialRelationship,
  UserSearchResultDto,
} from './dto/social.dto';

type DatabaseExecutor = Kysely<Database> | Transaction<Database>;

interface SocialUserJson extends JsonObject {
  screenName: string;
  streaks: StreakCountsJson;
  userId: string;
}

interface StreakCountsJson extends JsonObject {
  daily: number;
  monthly: number;
  weekly: number;
  yearly: number;
}

function normalizeContactDestination(
  channel: 'email' | 'phone',
  value: string,
) {
  const trimmed = value.trim();
  if (channel === 'email') {
    const email = trimmed.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException({
        code: 'CHALLENGE_CONTACT_EMAIL_INVALID',
        message: 'Enter a valid email address.',
      });
    }
    return email;
  }
  const phone = trimmed.replace(/[\s().-]/g, '');
  if (!/^\+?[1-9]\d{7,14}$/.test(phone)) {
    throw new BadRequestException({
      code: 'CHALLENGE_CONTACT_PHONE_INVALID',
      message: 'Enter a phone number with country code.',
    });
  }
  return phone.startsWith('+') ? phone : `+${phone}`;
}

function contactDestinationHint(
  channel: 'email' | 'phone',
  destination: string,
) {
  if (channel === 'email') {
    const [local, domain] = destination.split('@');
    return `${local.slice(0, 1)}***@${domain}`;
  }
  return `•••${destination.slice(-4)}`;
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
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

interface ChallengeMemberJson extends JsonObject {
  progress: ChallengeProgressJson;
  role: 'member' | 'owner';
  screenName: string;
  streaks: StreakCountsJson;
  status: SocialChallengeMemberStatus;
  userId: string;
}

interface ChallengeProgressJson extends JsonObject {
  completedCount: number;
  completionPercent: number;
  targetTotal: number;
}

interface SocialChallengeJson extends JsonObject {
  activity: SocialChallengeActivity;
  activityLabel: string;
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
  ownerUserId: string;
  participantCount: number;
  participantLimit: number | null;
  regionCode: string | null;
  regionName: string | null;
  scheduledDays: number[];
  scheduledTime: string | null;
  startDate: string;
  targetCount: number;
  targetPeriod: SocialChallengeTargetPeriod;
  timezone: string | null;
}

interface ChallengeInvitationJson extends JsonObject {
  challengeId: string;
  status: SocialChallengeMemberStatus;
  userId: string;
}

interface ChallengeContactInvitationJson extends JsonObject {
  challengeId: string;
  channel: 'email' | 'phone';
  destinationHint: string;
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

export function socialChallengeDateWindow(
  challenges: readonly {
    end_date: Date | string;
    start_date: Date | string;
  }[],
): { endDate: string; startDate: string } | null {
  if (challenges.length === 0) return null;

  const startDates = challenges.map(({ start_date }) =>
    normalizeDateKey(start_date),
  );
  const endDates = challenges.map(({ end_date }) => normalizeDateKey(end_date));
  return {
    endDate: endDates.reduce((latest, value) =>
      value > latest ? value : latest,
    ),
    startDate: startDates.reduce((earliest, value) =>
      value < earliest ? value : earliest,
    ),
  };
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
        const query = input.screenName.trim();
        const escapedQuery = query.replace(/[\\%_]/g, '\\$&');
        const candidates = await transaction
          .selectFrom('profiles')
          .innerJoin('users', 'users.id', 'profiles.user_id')
          .select(['profiles.screen_name', 'profiles.user_id'])
          .where('users.status', '=', 'active')
          .where('profiles.user_id', '!=', user.id)
          .where(
            sql<boolean>`${sql.ref('profiles.screen_name')}::text ILIKE ${`%${escapedQuery}%`} ESCAPE '\\'`,
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
        const friendIds = friendships.map((friendship) =>
          friendship.user_a_id === user.id
            ? friendship.user_b_id
            : friendship.user_a_id,
        );
        const identities = await this.loadSocialUsers(transaction, friendIds);

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
        const otherIds = requests.map((request) =>
          request.requester_user_id === user.id
            ? request.recipient_user_id
            : request.requester_user_id,
        );
        const identities = await this.loadSocialUsers(transaction, otherIds);

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
        const request = await transaction
          .selectFrom('friend_requests')
          .selectAll()
          .where('id', '=', requestId)
          .where('recipient_user_id', '=', user.id)
          .forUpdate()
          .executeTakeFirst();
        if (!request) {
          throw new NotFoundException({
            code: 'FRIEND_REQUEST_NOT_FOUND',
            message: 'That incoming friend request was not found.',
          });
        }
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
        const region = await this.resolveRegionPolicy(
          transaction,
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
    if (!name) {
      throw new BadRequestException({
        code: 'CHALLENGE_NAME_REQUIRED',
        message: 'Enter a name for the challenge.',
      });
    }
    this.assertChallengeWindow(input.startDate, input.endDate);
    if (input.challengeType === 'friend' && invitedFriendUserIds.length === 0) {
      throw new BadRequestException({
        code: 'CHALLENGE_FRIEND_REQUIRED',
        message: 'Choose at least one accepted friend to challenge.',
      });
    }
    if (
      input.challengeType === 'regional' &&
      (!input.regionCode ||
        !locationName ||
        !input.scheduledTime ||
        input.scheduledDays.length === 0)
    ) {
      throw new BadRequestException({
        code: 'REGIONAL_CHALLENGE_SCHEDULE_REQUIRED',
        message:
          'Regional challenges require a region, location, local time, and at least one scheduled day.',
      });
    }

    return this.idempotency.execute<SocialChallengeJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: {
          ...input,
          activityLabel,
          description,
          invitedFriendUserIds,
          locationName,
          name,
        },
        responseCode: 201,
        scope: 'social:challenges:create',
      },
      async (transaction) => {
        const { user } = await this.ensureIdentity(principal, transaction);
        const region =
          input.challengeType === 'regional'
            ? await this.resolveRegionPolicy(
                transaction,
                input.regionCode ?? '',
              )
            : null;
        if (invitedFriendUserIds.length > 0) {
          await this.assertAcceptedFriends(
            transaction,
            user.id,
            invitedFriendUserIds,
          );
        }
        const now = new Date();
        const challenge = await transaction
          .insertInto('social_challenges')
          .values({
            activity: input.activity,
            activity_label: activityLabel,
            challenge_type: input.challengeType,
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
            updated_at: now,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await transaction
          .insertInto('social_challenge_members')
          .values({
            challenge_id: challenge.id,
            created_at: now,
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
                created_at: now,
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
        const created = await this.loadChallenges(
          transaction,
          user.id,
          challenge.id,
        );
        return created[0];
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
          .select(['owner_user_id', 'status'])
          .where('id', '=', challengeId)
          .executeTakeFirst();
        if (!challenge || challenge.status !== 'active') {
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
            userId: input.friendUserId,
          };
        }

        const now = new Date();
        if (existing) {
          await transaction
            .updateTable('social_challenge_members')
            .set({
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
              created_at: now,
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
        return {
          challengeId,
          status: 'pending',
          userId: input.friendUserId,
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
      },
      async (transaction) => {
        const { user } = await this.ensureIdentity(principal, transaction);
        const challenge = await transaction
          .selectFrom('social_challenges')
          .select(['challenge_type', 'owner_user_id', 'status'])
          .where('id', '=', challengeId)
          .executeTakeFirst();
        if (!challenge || challenge.status !== 'active') {
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

        const token = randomBytes(24).toString('base64url');
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1_000);
        const invitation = await transaction
          .insertInto('challenge_contact_invitations')
          .values({
            challenge_id: challengeId,
            channel: input.channel,
            claimed_at: null,
            claimed_by_user_id: null,
            created_at: now,
            destination_hash: sha256(`${token}:${destination}`),
            destination_hint: contactDestinationHint(
              input.channel,
              destination,
            ),
            expires_at: expiresAt,
            invite_token_hash: sha256(token),
            inviter_user_id: user.id,
            status: 'pending',
          })
          .returning(['destination_hint', 'id'])
          .executeTakeFirstOrThrow();
        return {
          challengeId,
          channel: input.channel,
          destinationHint: invitation.destination_hint,
          expiresAt: expiresAt.toISOString(),
          id: invitation.id,
          joinUrl: `https://gogymgo.com/join?challengeInvite=${encodeURIComponent(token)}`,
        };
      },
    );
  }

  redeemContactInvitation(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    token: string,
  ): Promise<ChallengeInvitationResponseDto> {
    const tokenHash = sha256(token.trim());
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
            'challenge.owner_user_id',
            'challenge.status as challenge_status',
            'invitation.expires_at',
            'invitation.id',
            'invitation.status',
          ])
          .where('invitation.invite_token_hash', '=', tokenHash)
          .forUpdate()
          .executeTakeFirst();
        if (!invitation || invitation.challenge_status !== 'active') {
          throw new NotFoundException({
            code: 'CHALLENGE_CONTACT_INVITATION_NOT_FOUND',
            message: 'That challenge invitation is not available.',
          });
        }
        if (invitation.status !== 'pending') {
          throw new ConflictException({
            code: 'CHALLENGE_CONTACT_INVITATION_RESOLVED',
            message:
              'That challenge invitation has already been used or revoked.',
          });
        }
        const now = new Date();
        if (invitation.expires_at <= now) {
          await transaction
            .updateTable('challenge_contact_invitations')
            .set({ status: 'expired' })
            .where('id', '=', invitation.id)
            .execute();
          throw new ConflictException({
            code: 'CHALLENGE_CONTACT_INVITATION_EXPIRED',
            message: 'That challenge invitation has expired.',
          });
        }
        if (invitation.owner_user_id === user.id) {
          throw new BadRequestException({
            code: 'CHALLENGE_OWNER_ALREADY_JOINED',
            message: 'You already own this challenge.',
          });
        }
        await transaction
          .insertInto('social_challenge_members')
          .values({
            challenge_id: invitation.challenge_id,
            created_at: now,
            invited_by_user_id: invitation.owner_user_id,
            responded_at: now,
            role: 'member',
            status: 'accepted',
            updated_at: now,
            user_id: user.id,
          })
          .onConflict((conflict) =>
            conflict.columns(['challenge_id', 'user_id']).doUpdateSet({
              responded_at: now,
              status: 'accepted',
              updated_at: now,
            }),
          )
          .execute();
        await transaction
          .updateTable('challenge_contact_invitations')
          .set({
            claimed_at: now,
            claimed_by_user_id: user.id,
            status: 'claimed',
          })
          .where('id', '=', invitation.id)
          .execute();
        return {
          challengeId: invitation.challenge_id,
          status: 'accepted',
          userId: user.id,
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
            'challenge.status',
            'region.timezone',
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
        if (
          normalizeDateKey(challenge.end_date) <
          dateKeyInTimezone(new Date(), challenge.timezone ?? 'UTC')
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
          return { challengeId, status: 'accepted', userId: user.id };
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
              created_at: now,
              invited_by_user_id: challenge.owner_user_id,
              responded_at: now,
              role: 'member',
              status: 'accepted',
              updated_at: now,
              user_id: user.id,
            })
            .executeTakeFirstOrThrow();
        }
        return { challengeId, status: 'accepted', userId: user.id };
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
            'region.timezone',
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
        const eligibleDate = dateKeyInTimezone(
          now,
          challenge.timezone ?? 'UTC',
        );
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
        return {
          challengeId,
          status: input.decision,
          userId: user.id,
        };
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
    return { daily: 0, monthly: 0, weekly: 0, yearly: 0 };
  }

  private toStreaksJson(streaks?: StreakCounts): StreakCountsJson {
    return streaks
      ? {
          daily: streaks.daily,
          monthly: streaks.monthly,
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
        'challenge.target_count',
        'challenge.target_period',
        'region.code as region_code',
        'region.metro_name as region_name',
        'region.timezone as region_timezone',
      ])
      .where('challenge.id', 'in', challengeIds)
      .where('challenge.status', '=', 'active')
      .orderBy('challenge.start_date')
      .orderBy('challenge.created_at', 'desc')
      .execute();
    const activityWindow = socialChallengeDateWindow(challenges);
    if (!activityWindow) {
      return [];
    }
    const activeChallengeIds = challenges.map(({ id }) => id);
    const members = await executor
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
      .where('social_challenge_members.status', '!=', 'declined')
      .orderBy('social_challenge_members.created_at', 'asc')
      .execute();
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

    return challenges.flatMap((challenge) => {
      const startDate = normalizeDateKey(challenge.start_date);
      const endDate = normalizeDateKey(challenge.end_date);
      const targetTotal = this.challengeTargetTotal(
        startDate,
        endDate,
        challenge.target_count,
        challenge.target_period,
      );
      const challengeMembers = members
        .filter((member) => member.challenge_id === challenge.id)
        .map((member) => {
          const dates = new Set(
            checkInDates.get(
              this.challengeMemberKey(challenge.id, member.user_id),
            ) ?? [],
          );
          if (challenge.activity === 'gym') {
            for (const date of verifiedDatesByUser.get(member.user_id) ?? []) {
              if (date >= startDate && date <= endDate) {
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
            status: member.status,
            streaks: this.toStreaksJson(streaksByUser.get(member.user_id)),
            userId: member.user_id,
          };
        });
      const mine = challengeMembers.find((member) => member.userId === userId);
      const owner = challengeMembers.find((member) => member.role === 'owner');
      if (!owner) {
        return [];
      }
      const emptyProgress = {
        completedCount: 0,
        completionPercent: 0,
        targetTotal,
      };
      return [
        {
          activity: challenge.activity,
          activityLabel: challenge.activity_label,
          challengeType: challenge.challenge_type,
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
          ownerUserId: challenge.owner_user_id,
          participantCount: challengeMembers.filter(
            ({ status }) => status === 'accepted',
          ).length,
          participantLimit: challenge.participant_limit,
          regionCode: challenge.region_code ?? null,
          regionName: challenge.region_name ?? null,
          scheduledDays: challenge.scheduled_days,
          scheduledTime: challenge.scheduled_time_local?.slice(0, 5) ?? null,
          startDate,
          targetCount: challenge.target_count,
          targetPeriod: challenge.target_period,
          timezone: challenge.region_timezone ?? null,
        },
      ];
    });
  }

  private async resolveRegionPolicy(
    executor: DatabaseExecutor,
    regionCode: string,
  ) {
    const now = new Date();
    const region = await executor
      .selectFrom('region_policies')
      .select(['code', 'id', 'metro_name', 'timezone'])
      .where('code', '=', regionCode.trim().toLowerCase())
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
    return region;
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
  }

  private assertChallengeWindow(
    startDateKey: string,
    endDateKey: string,
  ): void {
    const start = new Date(`${startDateKey}T00:00:00.000Z`);
    const end = new Date(`${endDateKey}T00:00:00.000Z`);
    const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
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
