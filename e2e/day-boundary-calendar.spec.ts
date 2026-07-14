import { test, expect } from '@playwright/test';

/**
 * THIS IS THE HIGH-VALUE ONE: it reproduces the class of bug the teamlead
 * reported, end-to-end, against the real running app (not a unit-level
 * approximation). The exact phrase from the bug report — "выполнен хотя бы
 * один челлендж" — is literally the tooltip/aria-label WeeklyCalendar.tsx
 * renders for a 'partial' day (see dayTitle() in that file), which is a very
 * strong signal this component is where the reported symptom actually
 * showed up.
 *
 * Strategy: seed the backend directly via API calls (sign up, create a
 * daily challenge, submit a session that fully closes "today" per the
 * BACKEND's clock), then load the dashboard in a browser whose clock has
 * been pushed to a different calendar day than the backend's — exactly
 * what happens for any user not on UTC, since the backend has no timezone
 * support (confirmed separately in the backend test suite). Then check
 * what the calendar actually shows.
 *
 * CAVEATS (read before trusting this test):
 * - I could not execute this in the sandbox (no network to install
 *   Playwright/browsers here) — selectors and request shapes are based on
 *   reading the source (challengeApi.ts, WeeklyCalendar.tsx,
 *   dashboardCalendar.ts, storage.ts), not a live run. Run it once and fix
 *   anything that doesn't match before trusting it as a regression guard.
 * - The backend's "today" is real server wall-clock time (UTC). This test
 *   pushes the BROWSER's clock forward across a local midnight to simulate
 *   a non-UTC user; it does not (and cannot, from the browser) change what
 *   the backend considers "today". That asymmetry is the whole point.
 * - If this test happens to run for you right at/near a real UTC midnight,
 *   the backend's own day may roll over mid-test and change the expected
 *   outcome — not likely, but worth knowing.
 */

interface SignupResult {
  email: string;
  password: string;
  token: string;
}

async function signUpAndLogIn(page: import('@playwright/test').Page): Promise<SignupResult> {
  const stamp = Date.now();
  const email = `e2e-daycheck-${stamp}@example.com`;
  const password = 'Test123!';

  const signupResp = await page.request.post('/api/auth/signup', {
    data: {
      username: `e2edaycheck${stamp}`,
      email,
      password,
      first_name: 'E2E',
      last_name: 'Test',
    },
  });
  expect(signupResp.ok()).toBeTruthy();

  const loginResp = await page.request.post('/api/auth/login', {
    data: { email, password },
  });
  expect(loginResp.ok()).toBeTruthy();
  const { token } = await loginResp.json();
  return { email, password, token };
}

async function createDailyChallengeAndCloseToday(
  page: import('@playwright/test').Page,
  token: string,
): Promise<void> {
  const createResp = await page.request.post('/api/challenges', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name: 'Day Boundary Check',
      schedule_type: 'daily',
      exercises: [{ exercise_id: 1, goal: 1 }], // goal=1 so a single session closes it
    },
  });
  expect(createResp.ok()).toBeTruthy();
  const challenge = await createResp.json();
  const challengeExerciseId = challenge.exercises[0].challenge_exercise_id;

  const submitResp = await page.request.post(`/api/challenges/${challenge.id}/sessions`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { challenge_exercise_id: challengeExerciseId, total_reps: 1, clean_reps: 1 },
  });
  expect(submitResp.ok()).toBeTruthy();
  const result = await submitResp.json();
  expect(result.day_closed).toBe(true); // sanity check: today really did close, per the backend
}

async function seedBrowserSession(
  page: import('@playwright/test').Page,
  token: string,
): Promise<void> {
  await page.addInitScript((authToken) => {
    localStorage.setItem('wowfit_auth_token', authToken);
    localStorage.setItem('wowfit_remember_me', 'true');
  }, token);
}

test.describe('client/server day-boundary calendar mismatch', () => {
  test('a day actually completed per the backend must not show as missed', async ({
    page,
  }) => {
    const { token } = await signUpAndLogIn(page);

    // Anchor the clock at 23:00 on the current (real) calendar day — this
    // is "today" per both the browser and the backend at the moment we
    // create the challenge and close it.
    const beforeMidnight = new Date();
    beforeMidnight.setHours(23, 0, 0, 0);
    await page.clock.install({ time: beforeMidnight });

    await createDailyChallengeAndCloseToday(page, token);
    // Build the ISO date from LOCAL fields (not toISOString(), which would
    // convert to UTC and could shift the date depending on the runner's
    // own timezone offset — the same class of mistake this test exists to
    // catch elsewhere).
    const y = beforeMidnight.getFullYear();
    const m = String(beforeMidnight.getMonth() + 1).padStart(2, '0');
    const d = String(beforeMidnight.getDate()).padStart(2, '0');
    const completedIsoDate = `${y}-${m}-${d}`;

    // Now push the BROWSER's clock 2 hours forward, past local midnight —
    // simulating a user in a timezone ahead of the backend's UTC clock,
    // shortly after their own local midnight (the "00:05" window from the
    // bug report). The backend itself is untouched: it still considers the
    // session above to belong to `completedIsoDate`.
    await page.clock.fastForward('02:00:00');

    await seedBrowserSession(page, token);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'План на сегодня' })).toBeVisible();

    // Find the specific day button for the day that was ACTUALLY completed
    // (its aria-label starts with its day-of-month number) and check its
    // title. This is the direct, load-bearing assertion of this test.
    const completedDayNumber = Number(completedIsoDate.slice(-2));
    const completedDayButton = page.getByRole('button', {
      name: new RegExp(`^${completedDayNumber}\\s`),
    });

    if ((await completedDayButton.count()) > 0) {
      await expect(completedDayButton.first()).toHaveAttribute(
        'title',
        'Все челленджи на день выполнены',
      );
    } else {
      // Likely means the completed day scrolled into last week's view, or
      // the selector above needs adjusting to match the real rendered
      // markup — inspect with `page.pause()` / `--debug` if this branch is
      // hit instead of the assertion above.
      test.fail(true, 'completed day button not found with the expected selector — see comment above');
    }
  });
});