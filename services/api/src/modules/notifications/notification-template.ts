import type { JsonObject } from '../../database/database.types';

export interface PushContent {
  body: string;
  data: JsonObject;
  title: string;
}

export function renderNotification(
  template: string,
  payload: JsonObject,
): PushContent {
  switch (template) {
    case 'competition_cancelled': {
      const competitionId = requirePayloadId(payload, 'competitionId');
      return {
        body: 'This competition was cancelled. No further workout action is required.',
        data: {
          competitionId,
          route: '/competitions',
        },
        title: 'GoGymGo competition cancelled',
      };
    }
    case 'reward_awarded': {
      const awardId = requirePayloadId(payload, 'awardId');
      return {
        body: 'You won a brand reward. Open My Rewards to claim it.',
        data: {
          awardId,
          route: '/rewards/awards',
        },
        title: 'You won a GoGymGo reward',
      };
    }
    default:
      throw new Error('Unknown notification template.');
  }
}

export function notificationDedupeKey(
  template: string,
  payload: JsonObject,
): string {
  switch (template) {
    case 'competition_cancelled':
      return `${template}:${requirePayloadId(payload, 'competitionId')}`;
    case 'reward_awarded':
      return `${template}:${requirePayloadId(payload, 'awardId')}`;
    default:
      throw new Error('Unknown notification template.');
  }
}

function requirePayloadId(payload: JsonObject, key: string) {
  const value = payload[key];
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > 128 ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  ) {
    throw new Error('The notification payload is invalid.');
  }
  return value;
}
