import { useEffect, useState } from 'react';

import { hasCompetitionStarted } from '@/domain/competition';

const maximumTimeoutMilliseconds = 2_147_483_647;

export function useCompetitionStart(startsAt: string | null | undefined) {
  const [started, setStarted] = useState(() => hasCompetitionStarted(startsAt));

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const update = () => {
      const now = Date.now();
      const nextStarted = hasCompetitionStarted(startsAt, now);
      setStarted(nextStarted);

      if (nextStarted || !startsAt) return;

      const startTime = Date.parse(startsAt);
      if (!Number.isFinite(startTime)) return;

      timeout = setTimeout(
        update,
        Math.min(Math.max(startTime - now + 25, 25), maximumTimeoutMilliseconds)
      );
    };

    update();
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [startsAt]);

  return started;
}
