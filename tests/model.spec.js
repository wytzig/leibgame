const { test, expect } = require('@playwright/test');

test('toont fallback melding wanneer modellen niet laden', async ({ page }) => {
  // Ga naar de pagina van het spel
  await page.goto('/')

  // Wacht tot het waarschuwingselement zichtbaar is
  const warning = page.locator('text=Model laden mislukt (gebruik fallback)');

  // Controleer of de waarschuwing zichtbaar is
  await expect(warning).toBeVisible();

  // Controleer of de multiplayer verbinding nog steeds werkt
  const multiplayer = page.locator('text=Multiplayer verbonden!');
  await expect(multiplayer).toBeVisible();

  // Optioneel: controleer of de startknop aanwezig is
  const startButton = page.locator('button', { hasText: 'Start Spel' });
  await expect(startButton).toBeVisible();
});
