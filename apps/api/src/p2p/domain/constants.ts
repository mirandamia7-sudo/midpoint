/**
 * The P2P market's tunable values. The contract's own bounds
 * (window limits, fee caps, permission bits) are mirrored here because the
 * service validates a request BEFORE spending the matcher's gas on it: a
 * request the contract would revert must be a 400, not a failed transaction.
 */

// --- the contract's own bounds (packages/contracts, docs/STELLAR.md 4.1) ----

/** `MAX_PROTOCOL_FEE_BPS`. */
export const P2P_MAX_PROTOCOL_FEE_BPS = 300;
/** `MAX_INTEGRATOR_FEE_BPS`: the most a client may charge its own users per order. */
export const P2P_MAX_INTEGRATOR_FEE_BPS = 500;
/** `MIN_PAYMENT_WINDOW` / `MAX_PAYMENT_WINDOW`, seconds. */
export const P2P_MIN_PAYMENT_WINDOW_SECONDS = 5 * 60;
export const P2P_MAX_PAYMENT_WINDOW_SECONDS = 2 * 24 * 60 * 60;
/** `MIN_ACCEPT_WINDOW` / `MAX_ACCEPT_WINDOW`, seconds (only orders with a bond). */
export const P2P_MIN_ACCEPT_WINDOW_SECONDS = 60;
export const P2P_MAX_ACCEPT_WINDOW_SECONDS = 24 * 60 * 60;
/** `MIN_SETTLE_WINDOW` / `MAX_SETTLE_WINDOW`, seconds (0 = no settle window). */
export const P2P_MIN_SETTLE_WINDOW_SECONDS = 60 * 60;
export const P2P_MAX_SETTLE_WINDOW_SECONDS = 14 * 24 * 60 * 60;

/** Operator permission bits, as `setOperator` takes them. */
export const P2P_PERMISSIONS = {
  open: 1,
  release: 2,
  trade: 4,
  withdraw: 8,
} as const;
export type P2pPermission = keyof typeof P2P_PERMISSIONS;
/** Every bit at once (`PERM_ALL`): anything above is refused by the contract. */
export const P2P_PERMISSIONS_ALL = 15;

/** Basis points in one whole. */
export const P2P_BPS = 10_000n;

// --- default order terms --------------------------------------------------

/**
 * A purchase (and a charge) pays the merchant within 30 minutes: long enough
 * for a bank transfer between two people in the same country, short enough
 * that an abandoned order frees the merchant's liquidity the same hour.
 * No bond (the merchant sells, so the buyer has nothing to put up) and no
 * settle window (the merchant releases; silence is never consent here).
 */
export const P2P_BUY_PAYMENT_WINDOW_SECONDS = 30 * 60;

/**
 * A sale or a payout locks a bond of 10% of the amount from the MERCHANT (the
 * buyer of the tokens), taken when it accepts: a merchant that accepts and then
 * never pays loses a tenth of the order to the seller in a dispute, which is
 * what keeps a merchant from accepting orders it does not mean to pay.
 */
export const P2P_SELL_BOND_BPS = 1_000n;
/** A merchant has 5 minutes to accept a sale (its bot does it in seconds). */
export const P2P_SELL_ACCEPT_WINDOW_SECONDS = 5 * 60;
/** Then 30 minutes to send the local money, as for a purchase. */
export const P2P_SELL_PAYMENT_WINDOW_SECONDS = 30 * 60;
/**
 * A person who sells opens the order themselves (`openWithDeposit`), so the
 * settle window is theirs to agree to: once the merchant marked it paid, six
 * hours without a dispute release it. Long enough to check a bank statement,
 * short enough that a person who forgets to release does not hold the
 * merchant's tokens for days.
 */
export const P2P_SELL_SETTLE_WINDOW_SECONDS = 6 * 60 * 60;
/**
 * A payout releases on its own after six hours too, but only when the client
 * enabled `autoSettle` for the matcher; otherwise 0 and the client (or its
 * bot) releases.
 */
export const P2P_PAYOUT_SETTLE_WINDOW_SECONDS = 6 * 60 * 60;

/**
 * A QR payment (`QR_PAY`): the person pays a shop's QR through a merchant
 * that buys their tokens. The merchant has 2 minutes to accept (its bot does
 * it in seconds), 10 minutes to pay the QR with its banking app, and the
 * person then has an hour to confirm the shop got the money before the order
 * settles on its own. All within the contract's window bounds.
 */
export const P2P_QR_ACCEPT_WINDOW_SECONDS = 2 * 60;
export const P2P_QR_PAYMENT_WINDOW_SECONDS = 10 * 60;
export const P2P_QR_SETTLE_WINDOW_SECONDS = 60 * 60;

/** A quote holds its price and merchant for a minute. */
export const P2P_QUOTE_TTL_SECONDS = 60;
/**
 * A sale the person never signs is `failed` after this long: the quote's
 * minute plus time to approve and sign two transactions in a wallet. A late
 * signature still opens the order on-chain, and the indexer follows it then.
 */
export const P2P_SELL_SIGNATURE_TTL_SECONDS = 15 * 60;

/** Default and ceiling of a merchant's price lifetime (`priceTtlSeconds`). */
export const P2P_DEFAULT_PRICE_TTL_SECONDS = 10 * 60;
export const P2P_MAX_PRICE_TTL_SECONDS = 24 * 60 * 60;

/** Default of `P2P_MERCHANT_MAX_OPEN_ORDERS`: live orders one merchant account takes at once. */
export const P2P_DEFAULT_MERCHANT_MAX_OPEN_ORDERS = 5;

/** Items in one payout batch. */
export const P2P_PAYOUT_MAX_ITEMS = 100;

/** How long a registration challenge may be signed. */
export const P2P_CHALLENGE_TTL_SECONDS = 10 * 60;
/** Random bytes in a challenge's nonce. */
export const P2P_CHALLENGE_NONCE_BYTES = 16;

/** Candidates a quote reads on-chain (balance, matcher terms) after the database filters. */
export const P2P_MATCH_MAX_CANDIDATES = 8;

/** Orders a transfer-matches answer lists, best first. */
export const P2P_TRANSFER_MATCHES_LIMIT = 10;

/** List pages: default and maximum `take`. */
export const P2P_PAGE_DEFAULT = 20;
export const P2P_PAGE_MAX = 100;

/** Characters of a free-text field the API stores (labels, descriptions, references). */
export const P2P_TEXT_MAX = 140;

// --- money -------------------------------------------------------------

/** Decimals a price may carry (local money per one token). */
export const P2P_PRICE_DECIMALS = 6;

/**
 * The local currencies the market prices, with their minor units. A payment
 * rail names one of them; a new currency is one entry here. The market lists
 * them in this order (Bolivia first, then its neighbours).
 */
export const P2P_CURRENCIES = {
  BOB: { decimals: 2, country: 'BO' },
  PEN: { decimals: 2, country: 'PE' },
  BRL: { decimals: 2, country: 'BR' },
  ARS: { decimals: 2, country: 'AR' },
  CLP: { decimals: 0, country: 'CL' },
  COP: { decimals: 2, country: 'CO' },
  MXN: { decimals: 2, country: 'MX' },
} as const;
export type P2pCurrency = keyof typeof P2P_CURRENCIES;
export const P2P_CURRENCY_CODES = Object.keys(P2P_CURRENCIES) as P2pCurrency[];

// --- on-chain reads ------------------------------------------------------

/** How long a verified deployment (bytecode + tokens) is trusted before it is checked again. */
export const P2P_DEPLOYMENT_CHECK_TTL_MS = 10 * 60 * 1000;
/** A failed deployment check is retried after this long, not on every request. */
export const P2P_DEPLOYMENT_RETRY_MS = 60 * 1000;
/** `protocolFeeBps()` and `paused()` are read at most this often per network. */
export const P2P_PROTOCOL_READ_TTL_MS = 60 * 1000;
/** A merchant's free balance and matcher terms, cached this long for quotes. */
export const P2P_BALANCE_READ_TTL_MS = 15 * 1000;

/** A matcher transaction's upper time bound: dropped (never applied) after it. */
export const P2P_MATCHER_TX_TTL_SECONDS = 120;
/**
 * A matcher transaction the network has not answered after this long is sent
 * again, with the SAME signed bytes (never a new signature for the same call).
 */
export const P2P_MATCHER_REBROADCAST_MS = 20 * 1000;
/** Matcher transactions the follower looks at in one tick. */
export const P2P_MATCHER_FOLLOW_BATCH = 50;

/** Orders the expiry job cancels in one tick. */
export const P2P_EXPIRY_BATCH = 20;
/**
 * The expiry job waits this long past a deadline before cancelling, so a
 * buyer's `markPaid` sent in the deadline's last second is mined first.
 */
export const P2P_EXPIRY_GRACE_SECONDS = 120;

/** `getEvents` pages one deployment may read per indexer tick, and events per page. */
export const P2P_INDEXER_MAX_PAGES = 10;
export const P2P_INDEXER_PAGE_LIMIT = 200;

// --- locks -------------------------------------------------------------------

/**
 * Two-key advisory lock class for the matcher's queue: `(class,
 * hashtext(network))`. One signer per network at a time across replicas, so
 * two calls never sign the same sequence number.
 */
export const P2P_MATCHER_LOCK_CLASS = 881_033;
/**
 * Two-key class for a charge's checkout orders: `(class, hashtext(chargeId))`,
 * so the live-order limit and the creation budget are one step.
 */
export const P2P_CHARGE_LOCK_CLASS = 881_034;
/**
 * Two-key class for a merchant account's open orders: `(class,
 * hashtext(accountId))`, so two orders cannot both take its last slot.
 */
export const P2P_MERCHANT_LOCK_CLASS = 881_035;
/** Two-key class for the sponsor's budget: one budget check and write at a time. */
export const P2P_SPONSOR_LOCK_CLASS = 881_036;
/** Two-key class for a charge's balance payments: one live payment on a single-use charge. */
export const P2P_CHARGE_PAYMENT_LOCK_CLASS = 881_037;

// --- gasless submission and the app ---------------------------------------------

/** How long a submission waits for the network before answering `PENDING`. */
export const P2P_SUBMIT_WAIT_MS = 15_000;
/** Submissions the follower looks at in one tick. */
export const P2P_SUBMISSION_FOLLOW_BATCH = 50;
/** A charge's price in tokens holds for a minute. */
export const P2P_CHARGE_PAYMENT_TTL_SECONDS = 60;
/** The base reserve, stroops: an account takes two, a trustline one (sponsored activations). */
export const STELLAR_BASE_RESERVE_STROOPS = 5_000_000n;

// --- keyless checkout budgets ------------------------------------------------

/**
 * Orders one client (an IPv4 address or an IPv6 /48, stored as an HMAC) may
 * have live on one charge. Each costs the matcher's gas and locks a merchant's
 * liquidity for up to the payment window.
 */
export const P2P_CHECKOUT_MAX_LIVE_PER_CLIENT = 1;
/**
 * New orders one charge takes per window, from all clients together (`429`
 * with `Retry-After` past it): anyone holding the id may create one, so this
 * bounds what an id alone can spend.
 */
export const P2P_CHECKOUT_CHARGE_BUDGET = 5;
export const P2P_CHECKOUT_CHARGE_WINDOW_MS = 30 * 60 * 1000;
/** Bytes of a checkout payer token (256 bits). */
export const P2P_PAYER_TOKEN_BYTES = 32;
/** HKDF label of the key client addresses are MACed under on a checkout order. */
export const P2P_CHECKOUT_CLIENT_KEY_LABEL = 'midpoint checkout client v1';
