import { allocateRewardSlots } from './rewards.service';

function catalogItem(
  rewardCatalogItemId: string,
  inventoryTotal: number,
  awardedCount: number,
) {
  return {
    awardedCount,
    availableFrom: new Date('2026-07-01T00:00:00.000Z'),
    availableUntil: new Date('2026-08-31T23:59:59.000Z'),
    catalogVersion: 3,
    cashAmountCents: null,
    cashCurrency: null,
    displayOrder: 1,
    inventoryTotal,
    rewardCatalogItemId,
    rewardType: 'coupon' as const,
    sponsorName: 'Test sponsor',
    title: 'Test reward',
  };
}

function expectedSlot(rewardCatalogItemId: string, inventoryTotal: number) {
  const item = catalogItem(rewardCatalogItemId, inventoryTotal, 0);
  return {
    availableFrom: item.availableFrom,
    availableUntil: item.availableUntil,
    catalogVersion: item.catalogVersion,
    cashAmountCents: item.cashAmountCents,
    cashCurrency: item.cashCurrency,
    displayOrder: item.displayOrder,
    inventoryTotal: item.inventoryTotal,
    rewardCatalogItemId: item.rewardCatalogItemId,
    rewardType: item.rewardType,
    sponsorName: item.sponsorName,
    title: item.title,
  };
}

describe('reward slot allocation', () => {
  it('materializes only as many slots as the draw can award', () => {
    expect(
      allocateRewardSlots([catalogItem('reward-1', 100_000, 0)], 3),
    ).toEqual([
      expectedSlot('reward-1', 100_000),
      expectedSlot('reward-1', 100_000),
      expectedSlot('reward-1', 100_000),
    ]);
  });

  it('preserves catalog order and ignores exhausted inventory', () => {
    expect(
      allocateRewardSlots(
        [
          catalogItem('exhausted', 2, 2),
          catalogItem('reward-2', 3, 1),
          catalogItem('reward-3', 2, 0),
        ],
        3,
      ),
    ).toEqual([
      expectedSlot('reward-2', 3),
      expectedSlot('reward-2', 3),
      expectedSlot('reward-3', 2),
    ]);
  });
});
