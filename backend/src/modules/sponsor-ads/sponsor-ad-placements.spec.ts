import { buildSponsorAdPlacementInventory } from './sponsor-ad-placements';

describe('sponsor ad placement placeholders', () => {
  it('keeps every video placement ineligible without an active enrollment', () => {
    const inventory = buildSponsorAdPlacementInventory(null);
    const videoPlacements = inventory.placements.filter(
      ({ format }) => format === 'video',
    );

    expect(inventory.visualDeliveryEnabled).toBe(false);
    expect(videoPlacements).not.toHaveLength(0);
    expect(
      videoPlacements.every(
        ({ eligibilitySatisfied }) => !eligibilitySatisfied,
      ),
    ).toBe(true);
  });

  it('reserves an enrolled-user 15-second video after explicit login', () => {
    const inventory = buildSponsorAdPlacementInventory(
      '10000000-0000-4000-8000-000000000001',
    );
    const placement = inventory.placements.find(
      ({ key }) => key === 'post_login_video',
    );

    expect(placement).toEqual(
      expect.objectContaining({
        creativeId: null,
        creativeReady: false,
        deliveryMode: 'automatic',
        durationSeconds: 15,
        eligibilitySatisfied: true,
        frequencyPolicy: 'once_per_explicit_login',
        mediaUrl: null,
        status: 'placeholder',
        trackingEnabled: false,
        trigger: 'after_explicit_login_and_enrollment_resolution',
      }),
    );
    expect(placement?.excludedContexts).toEqual(
      expect.arrayContaining(['authentication', 'onboarding', 'public']),
    );
  });

  it('keeps banner eligibility separate from enrollment-gated video', () => {
    const inventory = buildSponsorAdPlacementInventory(null);
    const banner = inventory.placements.find(
      ({ key }) => key === 'member_screen_banner',
    );

    expect(banner).toEqual(
      expect.objectContaining({
        eligibilitySatisfied: true,
        format: 'banner',
        requiresActiveEnrollment: false,
      }),
    );
  });
});
