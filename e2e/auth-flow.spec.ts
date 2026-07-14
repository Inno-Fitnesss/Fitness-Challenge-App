import { test, expect } from '@playwright/test';

/**
 * Runs against a REAL backend + frontend dev server (see playwright.config.ts).
 * Each run uses a fresh, timestamp-unique account so it can be re-run
 * without clashing with previous runs' data.
 *
 * NOTE: uses id-based locators (#signup-password etc.) rather than
 * getByLabel(text) — the first version of this file used label text
 * matching and it reliably timed out on the password field for reasons
 * that weren't obvious from the source alone (possibly an accessible-name
 * computation quirk with the required-field asterisk, or something about
 * how the two password fields on the signup form interact with `exact`
 * matching). IDs read directly from SignUpForm.tsx / SignInForm.tsx are
 * unambiguous and sidestep the issue entirely.
 */

function uniqueUser() {
  const stamp = Date.now();
  return {
    username: `e2euser${stamp}`,
    email: `e2e-${stamp}@example.com`,
    password: 'Test123!',
  };
}

async function fillSignupForm(page: import('@playwright/test').Page, user: ReturnType<typeof uniqueUser>) {
  await page.goto('/auth?tab=signup');
  await page.locator('#signup-username').fill(user.username);
  await page.locator('#signup-email').fill(user.email);
  await page.locator('#signup-password').fill(user.password);
  await page.locator('#signup-confirm-password').fill(user.password);
  await page.getByRole('button', { name: 'Создать аккаунт' }).click();
}

test.describe('signup, dashboard, and a basic challenge flow', () => {
  test('a new user can sign up and land on the dashboard', async ({ page }) => {
    const user = uniqueUser();
    await fillSignupForm(page, user);

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: 'План на сегодня' })).toBeVisible();
  });

  test('an existing user can log back in', async ({ page }) => {
    const user = uniqueUser();
    await fillSignupForm(page, user);
    await expect(page).toHaveURL(/\/dashboard/);

    // Log out by clearing storage and reloading onto the auth page.
    await page.evaluate(() => localStorage.clear());
    await page.goto('/auth');

    await page.locator('#signin-email').fill(user.email);
    await page.locator('#signin-password').fill(user.password);
    await page.getByRole('button', { name: 'Войти' }).click();

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('wrong password shows an inline error and does not navigate away', async ({ page }) => {
    const user = uniqueUser();
    await fillSignupForm(page, user);
    await expect(page).toHaveURL(/\/dashboard/);

    await page.evaluate(() => localStorage.clear());
    await page.goto('/auth');
    await page.locator('#signin-email').fill(user.email);
    await page.locator('#signin-password').fill('WrongPassword!');
    await page.getByRole('button', { name: 'Войти' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/auth/);
  });
});