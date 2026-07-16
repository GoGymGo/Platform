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
    case 'competition_cancelled':
      return {
        body: 'This competition was cancelled. No further workout action is required.',
        data: {
          competitionId:
            typeof payload.competitionId === 'string'
              ? payload.competitionId
              : null,
          route: '/competitions',
        },
        title: 'GoGymGo competition cancelled',
      };
    case 'reward_awarded':
      return {
        body: 'You won a brand reward. Open My Rewards to claim it.',
        data: {
          awardId: typeof payload.awardId === 'string' ? payload.awardId : null,
          route: '/rewards/awards',
        },
        title: 'You won a GoGymGo reward',
      };
    default:
      throw new Error('Unknown notification template.');
  }
}
