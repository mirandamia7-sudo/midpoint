/* The public home page, English. */
import type es from '@/i18n/messages/es/landing';

const landing: typeof es = {
  metaTitle: '{brand}: international payments between people',
  metaDescription:
    'Send money to people in other countries and pay in each place’s currency, by bank transfer or QR. A local merchant completes each payment, and the money stays in a contract until it is confirmed.',
  hero: {
    title: 'International payments between people',
    body: 'Send money to someone in another country, pay by QR wherever you are or switch to your currency with a bank transfer. A local merchant completes each payment, and the money stays in a contract until it is confirmed.',
    open: 'Create account',
    merchant: 'I am a merchant',
    rails:
      'Bank transfer in Bolivia, Peru, Argentina, Chile and Colombia, PIX in Brazil and SPEI in Mexico.',
  },
  slip: {
    caption:
      'This is what an order looks like: the exact amount, the account and the time you have left.',
    order: 'Purchase order',
    transfer: 'Transfer exactly',
    to: 'To this account',
    holder: 'Holder',
    account: 'Account',
    receive: 'You receive',
    left: 'Time to pay',
    locked: 'Locked in the contract until the merchant confirms',
    button: 'I transferred',
  },
  how: {
    title: 'How a purchase works',
    lede: 'No ads board, no haggling: you type an amount and the market picks the merchant.',
    steps: [
      {
        title: 'Type the amount',
        body: 'In your currency. The market picks a merchant with a price and a track record, and shows what you receive, fee included.',
      },
      {
        title: 'Transfer the exact amount',
        body: 'From an account in your name, to the merchant’s account we show you, before the time runs out. Then tap “I transferred”.',
      },
      {
        title: 'Receive the USDC',
        body: 'The merchant sees your transfer and releases the order. The contract sends the USDC to your Stellar wallet, with no network fee for you.',
      },
    ],
    sell: 'Selling is the same in reverse: you lock your USDC in the order, the merchant transfers to your account, and you release the USDC once you see the money.',
  },
  app: {
    title: 'The app',
    body: 'It installs on your phone from the browser. Your balance is in digital dollars (USDC), and {brand} pays the network fees.',
    points: [
      {
        title: 'Send and receive',
        body: 'To an @handle, a Stellar address or with a link. It arrives in seconds.',
      },
      {
        title: 'Pay by QR',
        body: 'Scan a shop’s QR in Peru, Brazil or Argentina: a market merchant pays it for you in that country’s money.',
      },
      {
        title: 'Add money and withdraw',
        body: 'Buy USDC with a transfer from your bank and sell it when you need local money.',
      },
      {
        title: 'Pay charges',
        body: 'Pay a business’s charge link from your balance, with no transfer.',
      },
    ],
    cta: 'Open the app',
  },
  trust: {
    title: 'How each payment is protected',
    items: [
      {
        title: 'Locked in a contract',
        body: 'Every order locks the USDC in a public smart contract. {brand} holds no key that can move it anywhere else.',
      },
      {
        title: 'Deadlines refund',
        body: 'If the payment does not arrive in time, the order expires and the USDC goes back to whoever sold it. Nothing gets stuck.',
      },
      {
        title: 'Disputes with limits',
        body: 'If something goes wrong, a reviewer decides. It can only split the order between its buyer and its seller, never send it to anyone else.',
      },
      {
        title: 'Merchants with a track record',
        body: 'Every price shows how many orders the merchant completed and how fast it releases.',
      },
    ],
  },
  merchants: {
    title: 'For merchants',
    body: 'Put your liquidity to work without handing it over. Your USDC stays in the market contract in your name and you can withdraw it any time.',
    points: [
      'You authorise the market to open orders on your balance, with a per-order limit you choose.',
      'You publish prices per currency and payment method, by hand or with a bot through the API.',
      'Your bot forwards your bank’s transfer notices and gets the release back, ready to sign.',
      'Signed webhooks for every status change of your orders.',
    ],
    cta: 'Open the dashboard',
  },
  business: {
    title: 'For businesses and developers',
    body: 'Collect in local money and receive USDC, pay hundreds of people from one file, or build buying and selling into your own app.',
    points: [
      {
        title: 'Charges',
        body: 'One link and one QR code per charge. The payer transfers from their bank; you receive USDC.',
      },
      {
        title: 'Payouts',
        body: 'Upload a CSV: every row is checked before it is sent and every payout is tracked on its own.',
      },
      { title: 'Public API', body: 'Test and live keys with scopes, and HMAC-signed webhooks.' },
    ],
    codeLabel: 'Create a charge with the API',
    cta: 'Read the docs',
  },
  faq: {
    title: 'Questions',
    items: [
      {
        q: 'Does {brand} hold my funds?',
        a: 'No. The USDC is in your wallet or locked in each order’s contract. {brand} holds no key that can move it anywhere else.',
      },
      {
        q: 'Do I need an account?',
        a: 'Yes. You sign up with your email or your Google account, with no password. If you already have a Stellar wallet, you can use it in the dashboard.',
      },
      {
        q: 'Which network does it run on?',
        a: 'Stellar. {brand} pays the network fees: you do not need any XLM.',
      },
      {
        q: 'What if I transfer and the merchant does not release?',
        a: 'Report a problem from the order. The USDC stays locked and a reviewer decides with the receipts, between you and the merchant.',
      },
      {
        q: 'What if I do not transfer in time?',
        a: 'The order expires and nothing is charged. If you already transferred, do not cancel: report a problem.',
      },
      {
        q: 'How much does it cost?',
        a: 'Each merchant’s price and the market fee show before you open the order. You receive exactly what the quote says.',
      },
      {
        q: 'Why must the account be in my name?',
        a: 'The merchant checks the transfer comes from the person who opened the order. That stops payments from third-party accounts.',
      },
    ],
  },
  closing: {
    title: 'Create your account',
    body: 'With your email or your Google account. You see the price of each payment before you confirm it.',
  },
};

export default landing;
