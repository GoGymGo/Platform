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
        body: 'This competition was cancelled. No workout or payout action is required.',
        data: {
          competitionId:
            typeof payload.competitionId === 'string'
              ? payload.competitionId
              : null,
          route: '/competitions',
        },
        title: 'GoGymGo competition cancelled',
      };
    case 'payout_action_required':
      return {
        body: 'Set up your hosted Hyperwallet account so your prize can be paid.',
        data: {
          claimId: typeof payload.claimId === 'string' ? payload.claimId : null,
          route: '/profile/payout',
        },
        title: 'Your GoGymGo prize is ready',
      };
    default:
      throw new Error('Unknown notification template.');
  }
}
