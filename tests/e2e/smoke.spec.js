import { expect, test } from '@playwright/test';

test('loads app, starts a workout, and captures timer screenshot', async ({ page }, testInfo) => {
  await page.goto('/');

  const acknowledgeButton = page.getByRole('button', { name: 'I understand' });
  if (await acknowledgeButton.isVisible()) {
    await acknowledgeButton.click();
  }

  const beginButton = page.getByRole('button', { name: /begin|start again/i });
  await expect(beginButton).toBeVisible();
  await beginButton.click();

  const timerAction = page.locator('.timer-action');
  await expect(timerAction).toBeVisible();

  await expect(page.locator('.timer-screen')).toHaveScreenshot('timer-screen.png', {
    animations: 'disabled',
  });

  await testInfo.attach('timer-screen', {
    body: await page.locator('.timer-screen').screenshot(),
    contentType: 'image/png',
  });
});
