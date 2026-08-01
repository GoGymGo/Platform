import { allocateRewardSlots } from './rewards.service';

describe('reward slot allocation', () => {
  it('materializes only as many slots as the draw can award', () => {
    expect(
      allocateRewardSlots(
        [
          {
            awardedCount: 0,
            inventoryTotal: 100_000,
            rewardCatalogItemId: 'reward-1',
          },
        ],
        3,
      ),
    ).toEqual([
      { rewardCatalogItemId: 'reward-1' },
      { rewardCatalogItemId: 'reward-1' },
      { rewardCatalogItemId: 'reward-1' },
    ]);
  });

  it('preserves catalog order and ignores exhausted inventory', () => {
    expect(
      allocateRewardSlots(
        [
          {
            awardedCount: 2,
            inventoryTotal: 2,
            rewardCatalogItemId: 'exhausted',
          },
          {
            awardedCount: 1,
            inventoryTotal: 3,
            rewardCatalogItemId: 'reward-2',
          },
          {
            awardedCount: 0,
            inventoryTotal: 2,
            rewardCatalogItemId: 'reward-3',
          },
        ],
        3,
      ),
    ).toEqual([
      { rewardCatalogItemId: 'reward-2' },
      { rewardCatalogItemId: 'reward-2' },
      { rewardCatalogItemId: 'reward-3' },
    ]);
  });
});
