/* Pay a shop's local-money QR (Peru's, Brazil's PIX, Argentina's interoperable QR) through a market
   merchant: the shop's name and city, the amount in local money (the QR's own when it carries one,
   typed when it is static), the USDC it costs from the quote; one signature locks the USDC
   (`open_with_deposit`, pinned to the quote and the QR payment's fixed windows), then the order's
   own screen follows the merchant. A balance that cannot cover the payment at the market's
   approximate price is said up front, with "add money" already filled with what is missing in the
   person's own money, and no quote is asked for. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { parseEmv } from '@midpoint/payment-qr';
import { fmt, useI18n } from '@/i18n';
import { Icon } from '@/components/ui/Icon';
import { Notice, Skeleton } from '@/components/ui/controls';
import { useNow } from '@/components/ui/misc';
import { SignFlow } from '@/components/wallet/SignFlow';
import { trade } from '@/lib/api/endpoints';
import { appSubmitter } from '@/lib/api/app';
import { ApiError } from '@/lib/api/client';
import { money, rate } from '@/lib/format';
import { parseFiat, toBaseUnits } from '@/lib/p2p/amounts';
import { countdown, msLeft } from '@/lib/p2p/orders';
import { QR_PAY_WINDOWS, qrRail, trustQrQuote } from '@/lib/p2p/qr-pay';
import { saleTerms } from '@/lib/p2p/tx-verify';
import { saveQuoteTerms, saveSteps } from '@/lib/p2p/steps';
import { useSession } from '@/lib/session';
import { useAppData, usePrice } from '@/features/app/data';
import { Screen } from '@/features/app/shell';
import { Facts, useUsd, WalletSummary } from '@/features/app/parts';
import { keptQr } from '@/features/app/Scan';
import type { AcceptedQuote } from '@/lib/p2p/fees';
import type { P2pOrder, P2pQuote } from '@/lib/p2p/types';

/** What the payer screen keeps about a QR order (the payer never sees the QR again). */
export function keepQrOrder(id: string, info: { name: string | null; city: string | null }) {
  try {
    sessionStorage.setItem(`midpoint.app.qr-order:${id}`, JSON.stringify(info));
  } catch {
    /* the order screen shows the merchant only */
  }
}

export default function PayQr() {
  const { t, lang } = useI18n();
  const q = t.app.payQr;
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useSession();
  const {
    market,
    network,
    token,
    balance,
    refresh,
    currency: home,
    price: homePrice,
  } = useAppData();
  const fmtUsd = useUsd();
  const payload = (location.state as { qr?: string } | null)?.qr ?? keptQr();
  const qr = useMemo(() => {
    const parsed = payload ? parseEmv(payload) : null;
    return parsed?.ok ? parsed.qr : null;
  }, [payload]);
  const [typed, setTyped] = useState('');
  const [quote, setQuote] = useState<
    { q: P2pQuote; accepted: AcceptedQuote } | null | 'loading' | 'none' | 'untrusted'
  >(null);
  const [error, setError] = useState('');
  const order = useRef<P2pOrder | null>(null);
  const fiat = qr?.amount ?? (qr?.currency ? parseFiat(typed, qr.currency) : null);
  const now = useNow(!!quote && typeof quote === 'object');

  // Up front, before any quote: what the payment costs at the market's approximate price.
  const approx = usePrice(qr?.currency ?? null);
  const decimals = token?.decimals ?? 7;
  const have = BigInt(balance || '0');
  const approxUnits =
    fiat && approx
      ? toBaseUnits((Number(fiat) / approx).toFixed(Math.min(decimals, 6)), decimals)
      : null;
  const shortUpFront = !!fiat && (have === 0n || (!!approxUnits && BigInt(approxUnits) > have));

  const ask = useCallback(() => {
    if (!qr || !fiat || !network || !token) return;
    setQuote('loading');
    trade
      .qrQuote(
        {
          kind: 'QR_PAY',
          network: network.id,
          token: token.symbol,
          qr: qr.payload,
          ...(qr.amount ? {} : { fiatAmount: fiat }),
        },
        token.decimals,
      )
      .then((res) => {
        const accepted = trustQrQuote(
          res,
          { network: network.id, token: token.symbol, qr, fiatAmount: qr.amount ? null : fiat },
          token.decimals,
        );
        setQuote(accepted ? { q: res, accepted } : 'untrusted');
      })
      .catch(() => setQuote('none'));
  }, [qr, fiat, network, token]);

  useEffect(() => {
    order.current = null;
    if (!fiat || shortUpFront) return setQuote(null);
    const h = setTimeout(ask, qr?.amount ? 0 : 500);
    return () => clearTimeout(h);
  }, [fiat, ask, qr?.amount, shortUpFront]);

  const live = quote && typeof quote === 'object' ? quote : null;
  const expired = !!live && Date.parse(live.q.expiresAt) <= now;
  useEffect(() => {
    if (expired && !order.current) ask();
  }, [expired, ask]);

  if (!qr || !network || !token || !market || !session)
    return (
      <Screen back title={q.title}>
        {!payload || !qr ? (
          <div className="flex flex-col gap-3 pt-4">
            <Notice tone="warn">{q.noQr}</Notice>
            <Link to="/app/scan" className="btn btn-ink btn-lg">
              <Icon name="scan" size={20} />
              {t.app.qrOrder.tryAgain}
            </Link>
          </div>
        ) : (
          <Skeleton className="h-64" />
        )}
      </Screen>
    );

  const rail = qrRail(qr);
  const units = live ? (toBaseUnits(live.q.tokenAmount, token.decimals) ?? '0') : null;
  const short = !!units && BigInt(units) > have;
  const currency = qr.currency ?? '';

  /** "Add money" filled with what is missing, in the person's own money (the shop's QR may be in
      another country's): 2 % over, for the spread. */
  const topUp = (needUnits: string | null) => {
    const missing = needUnits ? Number(BigInt(needUnits) - have) / 10 ** token.decimals : 0;
    const amount = homePrice && missing > 0 ? Math.ceil(missing * homePrice * 1.02) : null;
    const params = new URLSearchParams({
      currency: home,
      ...(amount ? { amount: String(amount) } : {}),
    });
    return (
      <section className="sheet flex flex-col gap-3 p-4" aria-labelledby="topup-h" role="status">
        <h2 id="topup-h" className="text-[1.0625rem]">
          {q.topUpTitle}
        </h2>
        <p className="text-ink-2">
          {needUnits
            ? fmt(q.topUpBody, {
                need: `${needUnits === units ? '' : `${q.topUpApprox} `}${fmtUsd(needUnits)}`,
                have: fmtUsd(have),
              })
            : fmt(q.topUpEmpty, { have: fmtUsd(have) })}
        </p>
        <Link to={`/app/add?${params}`} className="btn btn-ink btn-lg">
          {q.topUp}
        </Link>
      </section>
    );
  };

  return (
    <Screen back title={q.title} aside={<WalletSummary />}>
      <div className="flex flex-col gap-4 pb-4">
        <div className="flex items-center gap-3 rounded-[18px] border border-line bg-sheet p-4">
          <span
            className="grid size-12 shrink-0 place-items-center rounded-full bg-well"
            aria-hidden="true"
          >
            <Icon name="store" size={24} />
          </span>
          <span className="flex min-w-0 flex-col">
            <b className="truncate text-[1.125rem]" data-testid="shop-name">
              {qr.merchantName ?? q.shop}
            </b>
            <span className="truncate text-[0.875rem] text-ink-3">
              {[qr.merchantCity, q.standard[qr.standard]].filter(Boolean).join(' · ')}
            </span>
          </span>
        </div>

        {!rail && <Notice tone="error" stay>{t.app.scan.qrNotTaken}</Notice>}

        {rail && (
          <div className="rounded-[20px] bg-well px-4 py-5 text-center">
            {qr.amount ? (
              <>
                <p className="text-[0.875rem] text-ink-3">{q.amountFixed}</p>
                <p className="figure mt-1 text-[2.3rem]">
                  <span className="marker">{money(lang, qr.amount, currency)}</span>
                </p>
              </>
            ) : (
              <>
                <label htmlFor="qr-amount" className="text-[0.875rem] text-ink-3">
                  {fmt(q.amountLabel, { currency })}
                </label>
                <input
                  id="qr-amount"
                  className="amount-input mt-1"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  autoFocus
                  value={typed}
                  onChange={(e) => setTyped(e.target.value.trim().replace(',', '.'))}
                  aria-invalid={typed && !fiat ? true : undefined}
                />
                <p className="mt-1 font-semibold text-ink-3">{currency}</p>
                {typed && !fiat && <p className="mt-1 text-[0.875rem] text-bad">{q.badAmount}</p>}
              </>
            )}
          </div>
        )}

        {rail && shortUpFront && topUp(approxUnits)}
        {quote === 'loading' && <Skeleton className="h-32" />}
        {quote === 'none' && <Notice tone="warn">{q.noQuote}</Notice>}
        {quote === 'untrusted' && <Notice tone="error" stay>{q.untrusted}</Notice>}
        {live && units && (
          <>
            <Facts
              rows={[
                [q.youPay, fmtUsd(units)],
                [q.shopGets, money(lang, live.q.fiatAmount, currency)],
                [t.trade.summary.merchant, live.q.merchant.displayName || '-'],
                [t.trade.fee, fmtUsd(toBaseUnits(live.q.protocolFee, token.decimals) ?? '0')],
              ]}
            />
            <p className="num text-center text-[0.8125rem] text-ink-3">
              {fmt(q.rate, { price: rate(lang, live.q.price), currency })} ·{' '}
              {fmt(q.validFor, { time: countdown(msLeft(live.q.expiresAt, now)) })}
            </p>
            <details className="rounded-[16px] border border-line px-4 py-3">
              <summary className="cursor-pointer font-semibold">{q.howTitle}</summary>
              <p className="mt-2 text-[0.9375rem] text-ink-2">{q.how}</p>
            </details>
            {short ? (
              topUp(units)
            ) : (
              <SignFlow
                network={network}
                signer={session.address}
                via={appSubmitter}
                sponsored={market.sponsor.enabled}
                startLabel={fmt(q.confirm, { amount: fmtUsd(units) })}
                steps={[
                  {
                    label: fmt(q.step, { amount: fmtUsd(units) }),
                    build: async () => {
                      setError('');
                      if (!order.current) {
                        order.current = await trade.createQrOrder(
                          { quoteId: live.q.id, qr: qr.payload },
                          token.decimals,
                        );
                        saveSteps(order.current.id, order.current.transactions);
                        saveQuoteTerms(order.current.id, live.accepted);
                        keepQrOrder(order.current.id, {
                          name: qr.merchantName,
                          city: qr.merchantCity,
                        });
                      }
                      const open = order.current.transactions?.[0];
                      if (!open) throw new ApiError(502, 'bad_response', 'no transaction');
                      return open;
                    },
                    expect: null,
                    expectFor: () => {
                      const o = order.current;
                      if (!o) return null;
                      const r = saleTerms({
                        orderId: o.id,
                        seller: session.address,
                        token: token.symbol,
                        accepted: live.accepted,
                        order: { amountUnits: live.accepted.amountUnits, buyer: o.buyer },
                        bondBps: market.sellBondBps,
                        windows: QR_PAY_WINDOWS,
                      });
                      return r.terms ? { action: 'open_with_deposit', ...r.terms } : null;
                    },
                  },
                ]}
                onError={(e) => {
                  if (e instanceof ApiError && e.code === 'insufficient_balance')
                    setError(q.insufficient);
                  else if (e instanceof ApiError && e.code === 'quote_expired') {
                    order.current = null;
                    ask();
                  }
                }}
                onDone={() => {
                  const id = order.current?.id;
                  refresh();
                  if (id) navigate(`/app/qr/${id}`, { replace: true });
                }}
              />
            )}
          </>
        )}
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </Screen>
  );
}
