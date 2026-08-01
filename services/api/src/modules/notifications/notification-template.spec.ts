import { renderNotification } from './notification-template';

describe('notification templates', () => {
  it('renders competition cancellation copy without financial details', () => {
    expect(
      renderNotification('competition_cancelled', {
        competitionId: 'competition-1',
      }),
    ).toEqual({
      body: 'This competition was cancelled. No further workout action is required.',
      data: {
        competitionId: 'competition-1',
        route: '/competitions',
      },
      title: 'GoGymGo competition cancelled',
    });
  });

  it('renders reward claim copy without exposing the coupon code', () => {
    expect(
      renderNotification('reward_awarded', { awardId: 'award-1' }),
    ).toEqual({
      body: 'You won a brand reward. Open My Rewards to claim it.',
      data: { awardId: 'award-1', route: '/rewards/awards' },
      title: 'You won a GoGymGo reward',
    });
  });

  it('rejects templates that are not explicitly registered', () => {
    expect(() => renderNotification('untrusted-template', {})).toThrow(
      /unknown notification template/i,
    );
  });
});
