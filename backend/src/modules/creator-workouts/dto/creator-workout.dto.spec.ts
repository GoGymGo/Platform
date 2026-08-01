import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateWeeklyChallengeRequestDto } from '../../competitions/dto/competition.dto';
import { InviteChallengeContactDto } from '../../social/dto/social.dto';
import { CreateCreatorVideoSubmissionDto } from './creator-workout.dto';

describe('new social and creator contracts', () => {
  it('requires an explicit creator rights attestation', async () => {
    const input = plainToInstance(CreateCreatorVideoSubmissionDto, {
      durationMinutes: 30,
      regionCode: 'victoria-bc',
      rightsAccepted: false,
      syntheticMediaDisclosed: true,
      title: 'Full Body HIIT',
      videoUrl: 'https://video.example/workout',
      workoutStyle: 'HIIT',
    });

    expect(
      (await validate(input)).some(
        ({ property }) => property === 'rightsAccepted',
      ),
    ).toBe(true);
  });

  it('accepts a complete creator submission contract', async () => {
    const input = plainToInstance(CreateCreatorVideoSubmissionDto, {
      durationMinutes: 30,
      regionCode: 'victoria-bc',
      rightsAccepted: true,
      syntheticMediaDisclosed: false,
      title: 'Full Body HIIT',
      videoUrl: 'https://video.example/workout',
      workoutStyle: 'HIIT',
    });

    expect(await validate(input)).toEqual([]);
  });

  it('validates Weekly Challenge partner requests and contact channels', async () => {
    const weeklyRequest = plainToInstance(CreateWeeklyChallengeRequestDto, {
      goal: 4,
      period: 2,
      recipientUserId: '10000000-0000-4000-8000-000000000002',
      region: 'victoria-bc',
    });
    const contactInvite = plainToInstance(InviteChallengeContactDto, {
      channel: 'email',
      destination: 'friend@example.com',
    });

    expect(await validate(weeklyRequest)).toEqual([]);
    expect(await validate(contactInvite)).toEqual([]);
  });
});
