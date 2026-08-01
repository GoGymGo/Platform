import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { goBackOrReplace } from '@/navigation/goBack';

describe('context-aware back navigation', () => {
  it('uses navigation history when a previous screen exists', () => {
    const actions: string[] = [];

    goBackOrReplace(
      {
        back: () => actions.push('back'),
        canGoBack: () => true,
        replace: (href) => actions.push(`replace:${String(href)}`)
      },
      '/home'
    );

    assert.deepEqual(actions, ['back']);
  });

  it('uses the safe fallback when a screen was opened directly', () => {
    const actions: string[] = [];

    goBackOrReplace(
      {
        back: () => actions.push('back'),
        canGoBack: () => false,
        replace: (href) => actions.push(`replace:${String(href)}`)
      },
      '/home'
    );

    assert.deepEqual(actions, ['replace:/home']);
  });
});
