/* The hosted charge page in a real browser (mock mode), in both languages: who pays, the exact
   transfer, a reload that resumes the order, then paid. */
import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, trackErrors } from '@e2e/helpers';

test('a payer pays a charge (Spanish), and a reload resumes the order', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/pay/ch_pedido1042?lang=es');
  await expect(page.getByText('Pago a Tienda Mamoré')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('250,00');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText('Obligatorio').first()).toBeVisible();
  await page.getByLabel('Nombre completo').fill('Diego Paz');
  await page.getByLabel('Número de documento').fill('5544332');
  await page.getByLabel('Email').fill('diego@example.com');
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.getByRole('button', { name: 'Ya transferí' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('1000023456789')).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.reload();
  await page.getByRole('button', { name: 'Ya transferí' }).click();
  await expect(page.getByRole('heading', { name: 'Transferencia informada' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pagado' })).toBeVisible({ timeout: 30_000 });
  expect(errors).toEqual([]);
});

test('the charge page in English, and a paid or unknown charge says so', async ({ page }) => {
  await page.goto('/c/ch_pedido1042?lang=en');
  await expect(page.getByText('Payment to Tienda Mamoré')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Who pays' })).toBeVisible();
  await page.goto('/pay/ch_pedido1039?lang=en');
  await expect(page.getByText('This request is already paid.')).toBeVisible();
  await page.goto('/pay/ch_doesnotexist1?lang=en');
  await expect(
    page.getByText('This payment request does not exist.', { exact: false }),
  ).toBeVisible();
});
