/* The public site in a real browser (mock mode): the landing in every language. Buying and selling
   now live in the payments app (e2e/app.spec.ts). */
import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, trackErrors } from '@e2e/helpers';

test('the landing reads in Spanish by default, then in English and Portuguese after switching', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Pagos internacionales entre personas',
  );
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expectNoHorizontalScroll(page);
  await page.getByRole('combobox', { name: 'Idioma' }).selectOption('en');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'International payments between people',
  );
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'How a purchase works' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Language' }).selectOption('pt');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Pagamentos internacionais entre pessoas',
  );
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt');
  await expectNoHorizontalScroll(page);
  // The choice holds on the next visit.
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Idioma' })).toHaveValue('pt');
  expect(errors).toEqual([]);
});
