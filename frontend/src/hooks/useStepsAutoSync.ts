import { useEffect } from 'react';
import { withingsApi } from '../api/withingsApi.ts';

/** How often to pull fresh steps while the app is open and visible. Matches the
 * profile widget's cadence so the whole app refreshes steps in lockstep. */
const SYNC_INTERVAL_MS = 2 * 60 * 1000;

/**
 * App-wide lazy polling of Withings steps.
 *
 * `POST /me/withings/sync` pulls the day's step total AND feeds it into any
 * step-based challenge (closing the day when the goal is met), so keeping it
 * ticking here is what makes steps count as an exercise without the user
 * re-opening the profile page.
 *
 * Three triggers, all client-side (no server cron, no webhook):
 *  - on entry: once when the authenticated shell mounts;
 *  - on refocus: when the tab/app becomes visible again (phone unlock, tab
 *    switch) — the common "came back an hour later" case;
 *  - a slow interval while visible: covers a long-running session where the
 *    user just sits in the app.
 *
 * Errors are swallowed on purpose: if Withings isn't connected the sync 400s,
 * which is expected and must not surface as a user-facing error.
 */
export function useStepsAutoSync(): void {
  useEffect(() => {
    let cancelled = false;

    const sync = () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void withingsApi.sync().catch(() => {
        /* not connected / Withings unavailable — best-effort background poll */
      });
    };

    sync(); // on entry

    const onVisible = () => {
      if (document.visibilityState === 'visible') sync();
    };
    document.addEventListener('visibilitychange', onVisible);

    const intervalId = window.setInterval(sync, SYNC_INTERVAL_MS);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(intervalId);
    };
  }, []);
}
