/* The payments app (/app) in a real browser, mock mode: sign in with SEP-10 and claim a handle,
   send to a handle, receive (payment link and SEP-7), scan a pasted payload, pay a shop's QR
   through a merchant, add money (buy), withdraw (sell), pay a charge from the balance, activate a
   new wallet, and the profile. Spanish and English. */
import { expect, test } from '@playwright/test';
import { appSignIn, demoQr, expectNoHorizontalScroll, trackErrors } from '@e2e/helpers';

test('sign in, claim a handle, and the home screen (Spanish)', async ({ page }) => {
  const errors = trackErrors(page);
  await appSignIn(page, 'es', 'user', { keepHandleOffer: true });
  await expect(page.getByRole('heading', { name: 'Elige tu @usuario' })).toBeVisible();
  await page.getByLabel('Usuario').fill('lucia');
  await page.getByRole('button', { name: 'Guardar @usuario' }).click();
  await expect(page.getByText('Alguien ya tiene @lucia')).toBeVisible();
  await page.getByLabel('Usuario').fill('sofia_r');
  await page.getByRole('button', { name: 'Guardar @usuario' }).click();
  await expect(page.getByText('Hola, @sofia_r')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('balance')).toHaveText('US$ 248,35');
  await expect(page.getByText(/≈ .*BOB/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('navigation', { name: 'Secciones de la app' }).first()).toBeVisible();
  await expect(page.getByText('Recibiste de @lucia')).toBeVisible();
  await expectNoHorizontalScroll(page);
  expect(errors).toEqual([]);
});

test('sign up: the @handle comes next, filled from the email, then the link that was open (Spanish)', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.goto('/app/send?to=%40lucia&amount=3&lang=es');
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await page.getByLabel('Email').fill('ana.perez@gmail.com');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByLabel('Código').fill('123456');
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Elige tu @usuario' })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByLabel('Usuario')).toHaveValue('ana_perez');
  await expect(page.getByRole('button', { name: 'Ahora no' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Guardar @usuario' }).click();
  await expect(page).toHaveURL(/\/app\/send\?to=%40lucia&amount=3/, { timeout: 15_000 });
  expect(errors).toEqual([]);
});

test('send to a handle with a note: review the resolved address, sign, done (Spanish)', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await appSignIn(page, 'es');
  await page.getByRole('link', { name: 'Enviar' }).click();
  await page.getByLabel('@usuario, dirección de Stellar o cuenta bancaria').fill('@nadie_aqui');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText('Nadie tiene @nadie_aqui.')).toBeVisible();
  await page.getByLabel('@usuario, dirección de Stellar o cuenta bancaria').fill('@lucia');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Cuánto envías, en dólares').fill('9999');
  await expect(page.getByText('Es más que tu saldo.')).toBeVisible();
  await page.getByLabel('Cuánto envías, en dólares').fill('12.5');
  await page.getByLabel('Nota (opcional)').fill('Pizza');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Revisa el envío' })).toBeVisible();
  await expect(page.getByText(/^G[A-Z2-7]{55}$/)).toBeVisible();
  await page.getByRole('button', { name: 'Enviar US$ 12,50' }).click();
  await expect(page.getByRole('heading', { name: 'Enviado' })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('link', { name: 'Listo' }).click();
  await expect(page.getByTestId('balance')).toHaveText('US$ 235,85', { timeout: 15_000 });
  await page.getByRole('link', { name: 'Actividad' }).click();
  await expect(page.getByText('Enviaste a @lucia').first()).toBeVisible();
  // A send that never opened: the whole row struck out in red, "Cancelada" instead of a pill.
  const never = page.locator('a[data-voided]').filter({ hasText: /37,00\sPEN/ });
  await expect(never).toHaveCount(1);
  await expect(never.getByText('Cancelada', { exact: true })).toBeVisible();
  await expect(never.locator('.pill')).toHaveCount(0);
  await expect(never.getByText('Retiraste a tu banco')).toHaveCSS(
    'text-decoration-line',
    'line-through',
  );
  await expect(page.getByText('Fallida')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('receive: a payment link with a handle, or a SEP-7 request (English)', async ({ page }) => {
  const errors = trackErrors(page);
  await appSignIn(page, 'en');
  await page.getByRole('link', { name: 'Receive' }).first().click();
  await expect(page.getByRole('img', { name: 'QR code to pay you' })).toBeVisible();
  await page.getByLabel('Ask for an amount in USDC (optional)').fill('20');
  // The handle taken right after sign-in (suggested from user@demo.test) names the payee.
  const link = page.getByText(/\/app\/send\?to=%40user&amount=20&asset=USDC/);
  await expect(link).toBeVisible();
  await expect(page.getByText(/≈ 237\.00\sBOB/)).toBeVisible({ timeout: 15_000 });
  // Asked in local money instead: the request carries the dollars, and says what arrives.
  await page.getByTestId('receive-unit').click();
  await page.getByRole('dialog').getByRole('button', { name: /BOB/ }).click();
  await expect(page.getByTestId('receive-unit')).toHaveAccessibleName(/BOB/);
  await page.getByLabel('Ask for an amount in BOB (optional)').fill('118.5');
  await expect(page.getByText('About $10.00 reaches your wallet.')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/\/app\/send\?to=%40user&amount=10(\.00)?&asset=USDC/)).toBeVisible();
  // The picker lists the network's tokens and every currency (the mock network has USDC only).
  await page.getByTestId('receive-unit').click();
  await expect(page.getByRole('dialog').getByRole('button', { name: /^USDC/ })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: /^PEN/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('switch', { name: 'For other Stellar wallets' }).click();
  await expect(page.getByText(/\/app\/send/)).toHaveCount(0);
  await expectNoHorizontalScroll(page);
  expect(errors).toEqual([]);
});

test('scan a pasted payload: a payment link opens send, a secret key warns (English)', async ({
  page,
  baseURL,
}) => {
  const errors = trackErrors(page);
  await appSignIn(page, 'en');
  await page.goto('/app/scan');
  await page
    .getByLabel('Code, link, address or @handle')
    .fill('SBU2RRGLXH3E5CQHTD3ODLDF2BWDCYUSSBLLZ5GNW7JXHDIYKXZWHOKR');
  await page.getByRole('button', { name: 'Read' }).click();
  await expect(page.getByRole('heading', { name: 'That is a secret key' })).toBeVisible();
  await page.getByRole('button', { name: 'Got it' }).click();
  await page
    .getByLabel('Code, link, address or @handle')
    .fill('https://evil.example/app/send?to=%40lucia');
  await page.getByRole('button', { name: 'Read' }).click();
  await expect(page.getByRole('alert').getByText(/That link is not from/)).toBeVisible();
  await page
    .getByLabel('Code, link, address or @handle')
    .fill(`${baseURL}/app/send?to=%40lucia&amount=3&note=Coffee`);
  await page.getByRole('button', { name: 'Read' }).click();
  await expect(page.getByRole('heading', { name: 'Check the payment' })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText('@lucia')).toBeVisible();
  await expect(page.getByText('Coffee')).toBeVisible();
  expect(errors).toEqual([]);
});

test('paste a QR: the text or the image on the clipboard opens the right screen (English)', async ({
  page,
  context,
  baseURL,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const errors = trackErrors(page);
  await appSignIn(page, 'en');

  // A payment link copied as text.
  await page.goto('/app/scan');
  await page.evaluate(
    (url) => navigator.clipboard.writeText(url),
    `${baseURL}/app/send?to=%40lucia&amount=3&note=Coffee`,
  );
  await page.getByRole('button', { name: 'Paste QR' }).click();
  await expect(page.getByRole('heading', { name: 'Check the payment' })).toBeVisible({
    timeout: 15_000,
  });

  // A QR copied as an image: the receive screen's own QR, as a PNG.
  await page.goto('/app/receive');
  const qr = page.getByRole('img', { name: 'QR code to pay you' });
  await expect(qr).toBeVisible();
  await qr.evaluate(async (img: HTMLImageElement) => {
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 480;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 480, 480);
    ctx.drawImage(img, 0, 0, 480, 480);
    const png = await new Promise<Blob>((done) => canvas.toBlob((b) => done(b!), 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
  });
  await page.goto('/app/scan');
  await page.getByRole('button', { name: 'Paste QR' }).click();
  await expect(page).toHaveURL(/\/app\/send\?/, { timeout: 15_000 });

  // Nothing usable on the clipboard says so.
  await page.goto('/app/scan');
  await page.evaluate(() => navigator.clipboard.writeText(''));
  await page.getByRole('button', { name: 'Paste QR' }).click();
  await expect(page.getByRole('alert').getByText(/There is no QR or code copied/)).toBeVisible();
  expect(errors).toEqual([]);
});

test("pay a shop's QR through a merchant: confirm, wait, the shop got paid, release (Spanish)", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = trackErrors(page);
  await appSignIn(page, 'es');
  const qr = await demoQr(page, 'cafe');
  await page.goto('/app/scan');
  await page.getByLabel('Código, enlace, dirección o @usuario').fill(qr);
  await page.getByRole('button', { name: 'Leer' }).click();
  await expect(page.getByTestId('shop-name')).toHaveText('Cafe El Balcon');
  await expect(page.locator('.marker')).toHaveText(/45,00\sPEN/);
  await page.getByRole('button', { name: /^Pagar US\$/ }).click({ timeout: 15_000 });
  await expect(page.getByTestId('qr-status')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Sí, el comercio cobró' }).click({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Sí, el comercio cobró' }).click();
  await expect(page.getByText('El comercio cobró 45,00 PEN.')).toBeVisible({ timeout: 20_000 });
  await expectNoHorizontalScroll(page);
  expect(errors).toEqual([]);
});

test('a QR the balance cannot cover: said up front, add money filled with what is missing (Spanish)', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await appSignIn(page, 'es', 'fresh');
  const qr = await demoQr(page, 'cafe');
  await page.goto('/app/scan');
  await page.getByLabel('Código, enlace, dirección o @usuario').fill(qr);
  await page.getByRole('button', { name: 'Leer' }).click();
  await expect(page.getByTestId('shop-name')).toHaveText('Cafe El Balcon');
  await expect(page.getByRole('heading', { name: 'Te falta saldo' })).toBeVisible();
  await expect(page.getByText(/Este pago cuesta aprox\. US\$/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /^Pagar US\$/ })).toHaveCount(0);
  await page.getByRole('link', { name: 'Agregar saldo' }).click();
  // In the person's own money (bolivianos), not the shop's soles.
  await expect(page.locator('#trade-amount')).toHaveValue('148');
  await expect(page.getByText('1 USDC = 12,05 BOB')).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});

test('add money: amount, who pays, the exact transfer, then the USDC arrive (Spanish)', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = trackErrors(page);
  await appSignIn(page, 'es');
  await page.getByRole('link', { name: 'Agregar' }).click();
  await page.locator('#trade-amount').fill('1200');
  await expect(page.getByText('1 USDC = 12,05 BOB')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Nombre completo').fill('Sofía Ruiz');
  await page.getByLabel('Número de documento').fill('6543210 LP');
  await page.getByRole('button', { name: 'Abrir orden' }).click();
  await expect(page.getByText('Transfiere exactamente')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.marker')).toHaveText(/1200,00\sBOB/);
  // A double tap reports the transfer once: no error, and the button stays off once it went.
  await page.getByRole('button', { name: 'Ya transferí' }).dblclick();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('Orden completada')).toBeVisible({ timeout: 30_000 });
  // The next purchase comes back with the payer filled in.
  await page.goto('/app/add');
  await page.locator('#trade-amount').fill('1200');
  await expect(page.getByText('1 USDC = 12,05 BOB')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByLabel('Nombre completo')).toHaveValue('Sofía Ruiz');
  await expect(page.getByLabel('Número de documento')).toHaveValue('6543210 LP');
  expect(errors).toEqual([]);
});

test('withdraw: the payout account, one signature, the merchant pays, release (English)', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = trackErrors(page);
  await appSignIn(page, 'en');
  await page.getByRole('link', { name: 'Withdraw' }).click();
  await page.locator('#trade-amount').fill('40');
  await expect(page.getByText('1 USDC = 11.85 BOB')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Account holder').fill('Sofía Ruiz');
  await page.getByLabel('Bank', { exact: true }).fill('Banco Unión');
  await page.getByLabel('Account type').selectOption('savings');
  await page.getByLabel('Account number').fill('1000023456781');
  await page.getByLabel('Document type').selectOption('CI');
  await page.getByLabel('Document number').fill('6543210');
  await page.getByRole('button', { name: 'Open order' }).click();
  await page.getByRole('button', { name: 'Sign', exact: true }).click({ timeout: 15_000 });
  await expect(page.getByText('Waiting for a merchant to accept the order.')).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole('button', { name: 'Release USDC' }).click({ timeout: 40_000 });
  await expect(page.getByText('Order completed')).toBeVisible({ timeout: 20_000 });
  expect(errors).toEqual([]);
});

test('pay a charge from the balance, or in bolivianos through the checkout (English)', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await appSignIn(page, 'en', 'user', { path: '/app/charge/ch_pedido1042' });
  await expect(page.getByText('Tienda Mamoré')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('link', { name: 'Pay in BOB by transfer' })).toHaveAttribute(
    'href',
    '/pay/ch_pedido1042',
  );
  await page.getByRole('button', { name: /^Pay \$\d/ }).click();
  await expect(page.getByRole('heading', { name: 'Paid' })).toBeVisible({ timeout: 20_000 });
  expect(errors).toEqual([]);
});

test('a new wallet activates for free, then can receive (Spanish)', async ({ page }) => {
  const errors = trackErrors(page);
  await appSignIn(page, 'es', 'fresh');
  await expect(page.getByRole('heading', { name: 'Activa tu wallet' })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('button', { name: 'Activar wallet' }).click();
  await expect(page.getByText('Tu wallet está lista para recibir USDC.').first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId('balance')).toHaveText('US$ 0,00');
  await expect(page.getByRole('heading', { name: 'Activa tu wallet' })).toBeHidden();
  expect(errors).toEqual([]);
});

test('profile: address, language, and sign out (English)', async ({ page }) => {
  const errors = trackErrors(page);
  await appSignIn(page, 'en');
  await page.getByRole('link', { name: 'Profile' }).click();
  await expect(page.getByText('Your address')).toBeVisible();
  await expect(page.getByText(/^G[A-Z2-7]{55}$/)).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sign out' }).click();
  await expect(
    page.getByRole('heading', { name: 'Pay like a local in any country' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('chat: the merchant sends the transfer receipt; the person writes and gets an answer (English)', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = trackErrors(page);
  await appSignIn(page, 'en');
  await page.getByRole('link', { name: 'Withdraw' }).click();
  await page.locator('#trade-amount').fill('25');
  await expect(page.getByText('1 USDC = 11.85 BOB')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Account holder').fill('Sofía Ruiz');
  await page.getByLabel('Bank', { exact: true }).fill('Banco Unión');
  await page.getByLabel('Account type').selectOption('savings');
  await page.getByLabel('Account number').fill('1000023456781');
  await page.getByLabel('Document type').selectOption('CI');
  await page.getByLabel('Document number').fill('6543210');
  await page.getByRole('button', { name: 'Open order' }).click();
  await page.getByRole('button', { name: 'Sign', exact: true }).click({ timeout: 15_000 });

  // The order's chat sits with the order; the merchant's receipt arrives once it paid.
  await expect(page.getByRole('heading', { name: 'Chat with the merchant' })).toBeVisible();
  const receipt = page.getByRole('button', { name: /Transfer receipt/ });
  await expect(receipt).toBeVisible({ timeout: 40_000 });
  await expect(page.getByText('Listo, ya te transferí. Te dejo el comprobante.')).toBeVisible();
  await receipt.click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: 'Transfer receipt' })).toBeVisible();
  await expect(sheet.getByRole('link', { name: 'Download' })).toHaveAttribute(
    'download',
    /^comprobante-.+\.pdf$/,
  );
  await page.keyboard.press('Escape');

  await page.getByLabel('Write a message').fill('Hi, I got it, thanks');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('log').getByText('Hi, I got it, thanks')).toBeVisible();
  await expect(page.getByLabel('Write a message')).toHaveValue('');
  await expect(page.getByText('De nada. Si necesitás algo más, escribime acá.')).toBeVisible({
    timeout: 15_000,
  });
  await expectNoHorizontalScroll(page);
  expect(errors).toEqual([]);
});

test('a Yape QR from Peru (static, the account an opaque token): typed amount in soles, paid through a merchant (English)', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = trackErrors(page);
  await appSignIn(page, 'en');
  const qr = await demoQr(page, 'yape');
  await page.goto('/app/scan');
  await page.getByLabel('Code, link, address or @handle').fill(qr);
  await page.getByRole('button', { name: 'Read' }).click();
  await expect(page.getByTestId('shop-name')).toHaveText('BODEGA LUCHO');
  await expect(page.getByText('Interoperable QR (Peru)')).toBeVisible();
  await page.locator('#qr-amount').fill('20');
  await expect(page.getByText('20.00 PEN')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: /^Pay \$\d/ }).click({ timeout: 15_000 });
  await expect(page.getByTestId('qr-status')).toBeVisible({ timeout: 20_000 });
  expect(errors).toEqual([]);
});

test('send to a bank account abroad: a CCI typed in "To" opens a sale to that account in soles (English)', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = trackErrors(page);
  await appSignIn(page, 'en');
  await page.goto('/app/send');
  await page.getByLabel('@handle, Stellar address or bank account').fill('00219300123456789012');
  await page.getByRole('button', { name: /Send to the CCI ••••9012/ }).click();
  await expect(page.getByRole('heading', { name: 'Send to a bank account' })).toBeVisible();
  // The amount is typed in what arrives (soles); what it costs in dollars follows.
  await page.getByLabel('They receive', { exact: true }).fill('74');
  await expect(page.getByText('1 USDC = 3.7 PEN')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('trade-dollars')).toHaveText('≈ $20.00');
  await expect(page.getByLabel('You send', { exact: true })).toHaveValue('20.00');
  // Typing in the dollars instead turns it around.
  await page.getByLabel('You send', { exact: true }).fill('30');
  await expect(page.getByLabel('They receive', { exact: true })).toHaveValue('111.00', {
    timeout: 15_000,
  });
  await expect(page.getByTestId('trade-dollars')).toHaveCount(0);
  await page.getByLabel('They receive', { exact: true }).fill('74');
  await expect(page.getByLabel('You send', { exact: true })).toHaveValue('20.00', {
    timeout: 15_000,
  });
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText(/^74\.00\sPEN$/).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Which account it goes to' })).toBeVisible();
  await expect(page.getByLabel('CCI')).toHaveValue('00219300123456789012');
  // A third party's ID is not asked: their bank already has it.
  await expect(page.getByLabel('Document type')).toHaveCount(0);
  await expect(page.getByLabel('Document number')).toHaveCount(0);
  await page.getByLabel('Account holder').fill('Rosa Quispe');
  await page.getByRole('button', { name: 'Open order' }).click();
  await page.getByRole('button', { name: 'Sign', exact: true }).click({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /Transfer receipt/ })).toBeVisible({
    timeout: 40_000,
  });
  expect(errors).toEqual([]);
});

test("send to someone's CVU in Argentina: their name and account only, no ID asked (Spanish)", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = trackErrors(page);
  await appSignIn(page, 'es');
  await page.goto('/app/send');
  await page
    .getByLabel('@usuario, dirección de Stellar o cuenta bancaria')
    .fill('0000003100012345678907');
  await page.getByRole('button', { name: /Enviar al CVU ••••8907/ }).click();
  await page.getByLabel('Recibe', { exact: true }).fill('14520');
  await expect(page.getByText(/1 USDC = 1452 ARS|1 USDC = 1\.452 ARS/)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId('trade-dollars')).toHaveText('≈ US$ 10,00');
  await page.getByRole('button', { name: 'Continuar' }).click();
  // One field for the account: a CBU, a CVU or an alias.
  await expect(page.getByLabel('CBU, CVU o alias')).toHaveValue('0000003100012345678907');
  await expect(page.getByLabel('Alias', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('CUIT o CUIL')).toHaveCount(0);
  await expect(page.getByLabel('Documento del titular')).toHaveCount(0);
  await page.getByLabel('Titular de la cuenta').fill('Martín Gómez');
  await page.getByRole('button', { name: 'Abrir orden' }).click();
  // The order speaks of the person who receives, not of "your account".
  await expect(page.getByText('Recibe Martín Gómez')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Firmar', exact: true }).click({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /Comprobante de transferencia/ })).toBeVisible({
    timeout: 40_000,
  });
  expect(errors).toEqual([]);
});

test('the sign-in fits the screen, and its toasts: the top right corner on a wide screen, down from the top on a phone (Spanish)', async ({
  page,
}, info) => {
  const wide = info.project.name === 'desktop';
  const errors = trackErrors(page);
  await page.goto('/app?lang=es');
  await page
    .getByRole('button', { name: 'Iniciar sesión', exact: true })
    .locator('visible=true')
    .first()
    .click();
  const google = page.getByRole('button', { name: 'Continuar con Google' });
  await expect(google).toBeVisible();
  if (wide) {
    // A laptop: the form in the right column, beside the aura, the way to sign up right under it.
    const g = (await google.boundingBox())!;
    const other = (await page.getByText('¿No tienes cuenta?').boundingBox())!;
    expect(g.x).toBeGreaterThan(page.viewportSize()!.width / 2);
    expect(other.y - (g.y + g.height)).toBeLessThan(80);
    // A tablet: the form alone, centred.
    await page.setViewportSize({ width: 800, height: 1024 });
    await expect
      .poll(async () => {
        const b = (await google.boundingBox())!;
        return Math.round(b.x + b.width / 2);
      })
      .toBe(400);
    await expectNoHorizontalScroll(page);
    await page.setViewportSize({ width: 1366, height: 900 });
  }
  await expectNoHorizontalScroll(page);

  await page.getByLabel('Email').fill('a@b');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  const toast = page.getByRole('alert');
  await expect(toast).toHaveText('Revisa el email.');
  const width = page.viewportSize()!.width;
  // Once it has come in: in the top right corner, or across the top of a phone.
  await expect
    .poll(async () => {
      const b = (await toast.boundingBox())!;
      return wide
        ? [Math.round(width - (b.x + b.width)), Math.round(b.y)]
        : [Math.round(b.x + b.width / 2 - width / 2), Math.round(b.y)];
    })
    .toEqual(wide ? [24, 24] : [0, 10]);
  // A tap sends it away.
  await toast.click();
  await expect(toast).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('from a tablet up the sections are at the side: icons on a tablet, with their names on a laptop; the home tiles fit a small phone (English)', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'the sizes are set by hand on the desktop project');
  await appSignIn(page, 'en');
  // The side navigation (the home's action tiles share its name).
  const nav = page
    .getByRole('navigation', { name: 'App sections' })
    .filter({ has: page.getByRole('link', { name: 'Activity' }) });
  const activity = nav.getByRole('link', { name: 'Activity' });
  await expect(activity).toHaveText('Activity');
  expect((await nav.boundingBox())!.width).toBe(260);
  // A tablet: a rail of icons; each link keeps its name.
  await page.setViewportSize({ width: 800, height: 1024 });
  await expect.poll(async () => (await nav.boundingBox())!.width).toBe(88);
  await expect(activity).toBeVisible();
  expect((await activity.boundingBox())!.width).toBe(48);
  await expect(nav.getByRole('link', { name: 'Scan' })).toBeVisible();
  await expectNoHorizontalScroll(page);
  // A 320px phone: the four action tiles keep their whole label.
  await page.setViewportSize({ width: 320, height: 640 });
  await expect(page.getByRole('link', { name: 'Withdraw' })).toBeVisible();
  const cut = await page.evaluate(() =>
    [...document.querySelectorAll('.tile .caps')]
      .filter((e) => e.scrollWidth > e.clientWidth)
      .map((e) => e.textContent),
  );
  expect(cut).toEqual([]);
  await expectNoHorizontalScroll(page);
});
