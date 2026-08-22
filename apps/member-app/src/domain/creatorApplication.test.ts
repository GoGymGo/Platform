import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  hasCreatorApplicationErrors,
  normalizeCreatorApplication,
  validateCreatorApplication
} from './creatorApplication';

describe('creator application', () => {
  it('normalizes and accepts a complete creator application', () => {
    const input = normalizeCreatorApplication({
      channelUrl: ' https://youtube.com/@cameron ',
      region: ' Toronto ',
      sampleWorkoutUrl: ' https://youtube.com/watch?v=sample ',
      workoutStyle: ' Strength and mobility '
    });

    assert.deepEqual(input, {
      channelUrl: 'https://youtube.com/@cameron',
      region: 'Toronto',
      sampleWorkoutUrl: 'https://youtube.com/watch?v=sample',
      workoutStyle: 'Strength and mobility'
    });
    assert.equal(hasCreatorApplicationErrors(validateCreatorApplication(input)), false);
  });

  it('requires a region, workout style and valid web links', () => {
    const errors = validateCreatorApplication({
      channelUrl: 'youtube',
      region: '',
      sampleWorkoutUrl: 'sample',
      workoutStyle: ''
    });

    assert.equal(errors.region, 'REGION IS REQUIRED.');
    assert.equal(errors.channelUrl, 'ENTER A VALID CREATOR CHANNEL URL.');
    assert.equal(errors.workoutStyle, 'WORKOUT STYLE IS REQUIRED.');
    assert.equal(errors.sampleWorkoutUrl, 'ENTER A VALID SAMPLE WORKOUT URL.');
  });

  it('accepts only bounded HTTPS URLs', () => {
    const errors = validateCreatorApplication({
      channelUrl: 'http://example.com/channel',
      region: 'BC',
      sampleWorkoutUrl: 'javascript:alert(1)',
      workoutStyle: 'HIIT'
    });

    assert.equal(errors.channelUrl, 'ENTER A VALID CREATOR CHANNEL URL.');
    assert.equal(errors.sampleWorkoutUrl, 'ENTER A VALID SAMPLE WORKOUT URL.');
  });
});
