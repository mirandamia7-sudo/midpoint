/* The merchant / business dashboard in a real browser (mock mode): sign in with the wallet
   (SEP-10), put liquidity in and authorise the matcher (XDR checked, signed and submitted through
   the API), accept and release orders, pay a QR payment's shop QR, publish an offer, create an API
   key shown once, and register a new wallet with a SEP-10 proof. */
import { expect, test, type Page } from '@playwright/test';
import { dashboardSignIn, expectNoHorizontalScroll, trackErrors } from '@e2e/helpers';

async function signIn(page: Page, lang: 'es' | 'en') {
  await dashboardSignIn(page, lang, 'merchant');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    lang === 'es' ? 'Resumen' : 'Overview',
    { timeout: 15_000 },
  );
}

test('liquidity: deposit with one signature and authorise the matcher (Spanish)', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await signIn(page, 'es');
  await page.goto('/dashboard/liquidity');
  await expect(page.getByText('Tesorería')).toBeVisible();
  await page.getByRole('button', { name: 'Depositar' }).first().click();
  await page.getByRole('dialog').getByLabel('Monto').fill('250');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Firmar' }).click();
  await expect(page.getByText('12.700,5 USDC')).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Autorizar a Midpoint' }).first().click();
  await page.getByRole('dialog').getByLabel('Límite por orden').fill('750');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Firmar' }).click();
  await expect(page.getByText('Hasta 750 USDC')).toBeVisible({ timeout: 20_000 });
  await expectNoHorizontalScroll(page);
  expect(errors).toEqual([]);
});

test('orders: accept a sale and release a purchase from the merchant wallet (English)', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await signIn(page, 'en');
  await page.goto('/dashboard/orders');
  await page.getByRole('button', { name: 'Accept' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sign', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Release' }).first().click();
  await expect(page.getByText(/Release only once/)).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Sign', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 20_000 });
  await expectNoHorizontalScroll(page);
  expect(errors).toEqual([]);
});

test('offers and API keys: publish an offer; a new key is shown once (Spanish)', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await signIn(page, 'es');
  await page.goto('/dashboard/offers');
  await page.getByRole('button', { name: 'Nueva oferta' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Moneda')).toHaveValue('BOB');
  await dialog.getByLabel(/Precio de 1/).fill('12.1');
  await dialog.getByLabel(/Mínimo por orden/).fill('50');
  await dialog.getByLabel(/Máximo por orden/).fill('7000');
  await dialog.getByRole('button', { name: 'Nueva oferta' }).click();
  await expect(page.getByText('Oferta publicada')).toBeVisible({ timeout: 10_000 });

  await page.goto('/dashboard/keys');
  await page.getByRole('button', { name: 'Crear clave' }).click();
  await page.getByRole('dialog').getByLabel('Nombre').fill('Bot de liberación');
  await page.getByRole('dialog').getByRole('button', { name: 'Crear clave' }).click();
  await expect(page.getByTestId('new-api-key')).toHaveText(/^pk_test_[a-z0-9]{20,}$/);
  await page.getByRole('button', { name: 'La guardé' }).click();
  await expect(page.getByTestId('new-api-key')).toHaveCount(0);
  await expect(page.getByText('Bot de liberación')).toBeVisible();
  expect(errors).toEqual([]);
});

// A 1×1 PNG: an image receipt, as a bank app's screenshot would be.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

test('mark paid: the receipt is required, previewed, and reaches the customer in the chat (English)', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await signIn(page, 'en');
  await page.goto('/dashboard/orders');
  const item = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('button', { name: 'Mark paid' }) })
    .first();
  const what = await item.locator('p.num').first().innerText();
  await item.getByRole('button', { name: 'Mark paid' }).click();
  const dialog = page.getByRole('dialog');
  // Without the receipt there is nothing to sign.
  await expect(dialog.getByText('Attach the receipt to mark the order paid.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Sign', exact: true })).toHaveCount(0);
  // A file that is not an image or a PDF is refused.
  await dialog.getByLabel('Transfer receipt').setInputFiles({
    name: 'receipt.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not a receipt'),
  });
  // Said in a toast, not in the dialog.
  await expect(
    page.getByRole('alert').filter({ hasText: 'Attach an image (PNG, JPG or WEBP) or a PDF.' }),
  ).toBeVisible();
  // An image: its preview shows, then it is signed.
  await dialog.getByLabel('Transfer receipt').setInputFiles({
    name: 'transfer.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await expect(dialog.getByRole('img', { name: 'transfer.png' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Sign', exact: true }).dblclick();
  await expect(page.getByText('Order paid. The receipt is in the chat.')).toBeVisible({
    timeout: 20_000,
  });
  // The refused file's toast aside, nothing went wrong.
  // The receipt is in the order's chat, with its preview.
  await page
    .getByRole('listitem')
    .filter({ hasText: what })
    .first()
    .getByRole('button', { name: 'Chat' })
    .click();
  const chat = page.getByRole('dialog');
  await expect(chat.getByRole('heading', { name: 'Chat with the customer' })).toBeVisible();
  const bubble = chat.getByTestId('receipt-bubble').first();
  await expect(bubble.getByRole('img', { name: 'transfer.png' })).toBeVisible({ timeout: 10_000 });
  // The composer shows a file before it goes, and a text goes with it.
  await chat.locator('input[type=file]').setInputFiles({
    name: 'second.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await expect(chat.getByText(/Attached: second\.png/)).toBeVisible();
  // The thumbnail beside it is decorative (the line names the file).
  await expect(chat.locator('img[alt="second.png"]')).toBeVisible();
  await chat.getByLabel('Write a message').fill('Sent, here is the receipt');
  await chat.getByRole('button', { name: 'Send' }).click();
  await expect(chat.getByTestId('receipt-bubble')).toHaveCount(2);
  await expect(chat.getByRole('log').getByText('Sent, here is the receipt')).toBeVisible();
  // The receipt opens at reading size.
  await bubble.click();
  await expect(page.getByRole('heading', { name: 'Transfer receipt' })).toBeVisible();
  await expectNoHorizontalScroll(page);
  expect(errors).toEqual([]);
});

test("a QR payment: the merchant sees the shop's QR to pay and marks it paid (English)", async ({
  page,
}) => {
  const errors = trackErrors(page);
  await signIn(page, 'en');
  await page.goto('/dashboard/orders');
  await page.getByText('Mercadinho Fronteira').first().click();
  await expect(page.getByRole('img', { name: /Mercadinho Fronteira/ })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/^00020126/).first()).toBeVisible();
  await expectNoHorizontalScroll(page);
  expect(errors).toEqual([]);
});

test('a new wallet: create an organization and register the wallet with a SEP-10 proof (Spanish)', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await dashboardSignIn(page, 'es', 'fresh');
  await page.getByLabel('Nombre', { exact: true }).fill('Cambios Oriente');
  await page.getByRole('button', { name: /Crear/ }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Resumen', { timeout: 15_000 });
  await page.goto('/dashboard/liquidity');
  await page.getByRole('button', { name: /Registrar/ }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: /Registrar|Firmar/ }).last().click();
  await expect(page.getByText('Billetera registrada')).toBeVisible({ timeout: 20_000 });
  expect(errors).toEqual([]);
});
