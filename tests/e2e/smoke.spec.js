import { expect, test } from '@playwright/test';

test('captures a timer screen smoke screenshot', async ({ page }, testInfo) => {
  await page.goto('/');

  const acknowledgeButton = page.getByRole('button', { name: 'I understand' });
  if (await acknowledgeButton.isVisible()) {
    await acknowledgeButton.click();
  }

  const beginButton = page.getByTestId('start-session');
  await expect(beginButton).toBeVisible();
  await beginButton.click();

  const timerScreen = page.getByTestId('timer-screen');
  await expect(timerScreen).toBeVisible();

  const screenshot = await timerScreen.screenshot({ animations: 'disabled' });
  await testInfo.attach('timer-screen', {
    body: screenshot,
    contentType: 'image/png',
  });
});
