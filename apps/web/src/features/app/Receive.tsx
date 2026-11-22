/* Receive: my QR, on a wallet card. By default a payment link (this app's /app/send?to=@handle...), which any phone
   camera opens; with the SEP-7 switch, a standard `web+stellar:pay` request for other Stellar
   wallets. An optional amount and note go in both. The amount is asked in any unit the picker
   lists: a token of the network (USDC, XLM: the request is in that token), or any currency the
   market pays out in (it becomes the wallet's token at the market's price, and what reaches the
   wallet is said under it). Copy and share (Web Share API). */
import { useMemo, useState } from 'react';
import { buildPaymentLink, buildSep7Pay } from '@midpoint/payment-qr';
import { fmt, useI18n } from '@/i18n';
import { Field, Notice, Switch } from '@/components/ui/controls';
import { CopyButton, CopyRow, Qr } from '@/components/ui/misc';
import { Icon } from '@/components/ui/Icon';
import { LogoGlyph } from '@/components/ui/Logo';
import { CurrencyMark, PickerSheet, TokenMark } from '@/components/p2p/parts';
import { currencyName, shortAddress } from '@/lib/format';
import { isQrRail } from '@/lib/p2p/qr-pay';
import { useSession } from '@/lib/session';
import { parseDecimal, toBaseUnits } from '@/lib/p2p/amounts';
import { fiatDecimals } from '@/lib/p2p/rails';
import { isDollarToken, tokensForLocal } from '@/lib/app/money';
import { useAppData, usePrice } from '@/features/app/data';
import { Screen } from '@/features/app/shell';
import { ActivationCard, useLocal, useUsd } from '@/features/app/parts';

/** A field beside another from 640px up: label, input and message each on a row the two share. */
const PAIRED = 'sm:row-span-3 sm:grid sm:grid-rows-subgrid sm:[&>label]:self-end';

export default function Receive() {
  const { t, lang } = useI18n();
  const r = t.app.receive;
  const { session } = useSession();
  const { market, profile, network, token: appToken, needsActivation } = useAppData();
  const fmtUsd = useUsd();
  const localOf = useLocal();
  const [amount, setAmount] = useState('');
  // The unit the amount is typed in: `token:USDC`, `token:XLM` or `fiat:BOB`; the wallet's token
  // to start with.
  const [unit, setUnit] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const tokens = network?.tokens ?? [];
  const currencies = (market?.currencies ?? []).filter((c) => c.rails.some((x) => !isQrRail(x)));
  const unitKey = unit ?? (appToken ? `token:${appToken.symbol}` : '');
  const [unitKind, unitCode] = unitKey.split(':') as ['token' | 'fiat', string];
  const fiat = unitKind === 'fiat' ? unitCode : null;
  // The token the request is in: the one picked, or (an amount in a currency) the wallet's own.
  const token = (fiat ? null : tokens.find((x) => x.symbol === unitCode)) ?? appToken;
  const price = usePrice(fiat);
  const [note, setNote] = useState('');
  const [sep7, setSep7] = useState(false);
  const address = session?.address ?? '';
  const decimals = fiat ? fiatDecimals(fiat) : token && isDollarToken(token.symbol) ? 2 : 7;
  const typed = amount ? parseDecimal(amount, decimals) : null;
  const amountOk = !amount || typed !== null;
  const noteOk = new TextEncoder().encode(note).length <= 28;
  // What the request asks for, in the token. An amount in a currency needs a price first: without
  // one the QR waits rather than leave the amount out.
  const wanted = typed && Number(typed) > 0 ? typed : null;
  const asked = wanted && fiat ? tokensForLocal(wanted, price) : wanted;
  const waiting = !!wanted && !asked;
  const askedText = asked && token ? fmtUsd(toBaseUnits(asked, 7) ?? '0', token.symbol) : '';
  const hint = !wanted
    ? undefined
    : fiat
      ? asked
        ? fmt(r.arrives, { amount: askedText })
        : price === null
          ? fmt(r.noPrice, { currency: fiat, unit: token?.symbol ?? '' })
          : undefined
      : token?.symbol === appToken?.symbol
        ? (localOf(toBaseUnits(wanted, 7) ?? '0') ?? undefined)
        : undefined;
  const pickUnit = (key: string) => {
    setPicking(false);
    if (key === unitKey) return;
    setUnit(key);
    setAmount('');
  };
  const unitMark = fiat ? (
    <CurrencyMark code={fiat} size={24} />
  ) : (
    <TokenMark symbol={unitCode} network={network?.name} size={24} />
  );

  const value = useMemo(() => {
    if (!address || !token || !network || !amountOk || !noteOk || waiting) return null;
    const a = asked;
    const n = note.trim() || null;
    try {
      return sep7
        ? buildSep7Pay({
            destination: address,
            amount: a,
            // The native coin (XLM) is named by no asset code or issuer.
            assetCode: token.issuer ? token.code : null,
            assetIssuer: token.issuer,
            memo: n,
            networkPassphrase: network.networkPassphrase,
          })
        : buildPaymentLink(location.origin, {
            to: profile?.handle ? `@${profile.handle}` : address,
            amount: a,
            asset: token.symbol,
            note: n,
          });
    } catch {
      return null;
    }
  }, [address, token, network, asked, waiting, note, sep7, profile, amountOk, noteOk]);

  return (
    <Screen title={r.title} width="page">
      {/* Wide screens (1280px up): the QR card on the left, what goes in it and the links on the right. */}
      <div className="grid gap-6 pb-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)] xl:items-start xl:gap-10">
        <p className="text-ink-2 xl:col-start-2 xl:row-start-1">
          {fmt(r.body, { brand: t.common.brand })}
        </p>
        {needsActivation && (
          <div className="flex flex-col gap-4 xl:col-start-2">
            <Notice tone="warn">{r.inactive}</Notice>
            <ActivationCard />
          </div>
        )}
        <div className="flex flex-col gap-4 xl:col-start-1 xl:row-span-6 xl:row-start-1">
          {/* The QR on a wallet card: the aura from ice to night, the handle at its foot. */}
          <div className="tone-dark aura-card grain flex flex-col items-center gap-4 overflow-hidden rounded-[24px] px-5 pt-4 pb-5 text-ink shadow-[var(--shadow-float)]">
            <div className="flex w-full items-center justify-between text-[#0a0b0e]">
              <span className="num text-[0.875rem] font-medium">{shortAddress(address)}</span>
              <LogoGlyph size={22} />
            </div>
            {value ? (
              <Qr value={value} label={r.qrLabel} size={224} />
            ) : (
              <div className="skeleton size-[224px]" />
            )}
            {profile?.handle ? (
              <b className="text-[1.375rem] font-semibold tracking-[-0.02em]">@{profile.handle}</b>
            ) : (
              <span className="text-[0.9375rem] text-ink-2">{network?.name}</span>
            )}
          </div>
          {value && (
            <div className="flex w-full gap-2">
              <CopyButton value={value} label={r.copyLink} className="btn-lg flex-1" />
              {typeof navigator.share === 'function' && (
                <button
                  type="button"
                  className="btn btn-ink btn-lg flex-1"
                  onClick={() =>
                    void navigator
                      .share({ text: fmt(r.shareText, { brand: t.common.brand, link: value }) })
                      .catch(() => {})
                  }
                >
                  <Icon name="share" size={20} />
                  {r.share}
                </button>
              )}
            </div>
          )}
          {!profile?.handle && <p className="text-[0.875rem] text-ink-3">{r.noHandle}</p>}
        </div>
        <div className="flex flex-col gap-3 xl:col-start-2">
          {/* Any unit: a token of the network or a currency, from one picker. */}
          <button
            type="button"
            className="flex items-center gap-2 self-start rounded-full border border-line bg-sheet py-1.5 pr-3 pl-1.5 transition-colors hover:border-ink"
            onClick={() => setPicking(true)}
            aria-haspopup="dialog"
            aria-label={fmt(r.changeUnit, { unit: unitCode })}
            data-testid="receive-unit"
          >
            {unitMark}
            <b className="font-bold">{unitCode}</b>
            <Icon name="chevron" size={16} />
          </button>
          {/* Side by side, the two fields share rows (a subgrid): the inputs line up even when
              one label takes two lines. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              className={PAIRED}
              label={fmt(r.amountIn, { unit: unitCode })}
              inputMode="decimal"
              placeholder={decimals === 0 ? '0' : '0.00'}
              value={amount}
              onChange={(e) => setAmount(e.target.value.trim().replace(',', '.'))}
              hint={hint}
              error={amountOk ? null : t.app.send.badAmount}
            />
            <Field
              className={PAIRED}
              label={r.note}
              value={note}
              maxLength={28}
              onChange={(e) => setNote(e.target.value)}
              error={noteOk ? null : t.app.send.noteTooLong}
            />
          </div>
        </div>
        {picking && (
          <PickerSheet
            title={r.unit}
            searchLabel={t.trade.searchCurrency}
            selected={unitKey}
            onClose={() => setPicking(false)}
            onPick={pickUnit}
            items={[
              ...tokens.map((x) => ({
                key: `token:${x.symbol}`,
                mark: <TokenMark symbol={x.symbol} network={network?.name} size={34} />,
                title: x.symbol,
                sub: network?.name ?? '',
                search: `${x.symbol} ${x.code}`,
              })),
              ...currencies.map((c) => ({
                key: `fiat:${c.code}`,
                mark: <CurrencyMark code={c.code} size={34} />,
                title: c.code,
                sub: currencyName(c.code, lang),
                search: `${c.code} ${currencyName(c.code, lang)}`,
              })),
            ]}
          />
        )}
        <div className="sheet flex items-center justify-between gap-4 px-5 py-4 xl:col-start-2">
          <span className="flex flex-col">
            <b className="font-semibold">{r.sep7}</b>
            <span className="text-[0.875rem] text-ink-3">{r.sep7Hint}</span>
          </span>
          <Switch label={r.sep7} checked={sep7} onChange={setSep7} />
        </div>
        <div className="sheet divide-y divide-line px-5 xl:col-start-2">
          {value && !sep7 && <CopyRow label={r.link} value={value} />}
          <CopyRow label={r.address} value={address} />
        </div>
      </div>
    </Screen>
  );
}
