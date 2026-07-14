import { renderNotification } from './notification-template';

describe('notification templates', () => {
  it('renders competition cancellation copy without financial details', () => {
    expect(
      renderNotification('competition_cancelled', {
        competitionId: 'competition-1',
      }),
    ).toEqual({
      body: 'This competition was cancelled. No workout or payout action is required.',
      data: {
        competitionId: 'competition-1',
        route: '/competitions',
      },
      title: 'GoGymGo competition cancelled',
    });
  });

  it('renders payout setup copy without financial or identity details', () => {
    expect(
      renderNotification('payout_action_required', { claimId: 'claim-1' }),
    ).toEqual({
      body: 'Set up your hosted Hyperwallet account so your prize can be paid.',
      data: { claimId: 'claim-1', route: '/profile/payout' },
      title: 'Your GoGymGo prize is ready',
    });
  });

  it('rejects templates that are not explicitly registered', () => {
    expect(() => renderNotification('untrusted-template', {})).toThrow(
      /unknown notification template/i,
    );
  });
});
