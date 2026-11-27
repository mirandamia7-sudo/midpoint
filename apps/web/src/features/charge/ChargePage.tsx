/* The hosted charge page (/c/{chargeId}): someone pays a business's request with a bank
   transfer, with no wallet and no account. Who pays (name, document, email) and how, then the
   merchant's account and the exact amount with the clock, "I transferred", and the status until
   the merchant confirms. Someone with dollars in the payments app can pay it from their balance
   there instead (/app/charge/{chargeId}). The QR rails are never offered here: they pay a shop's
   QR, not a merchant's account. The payer's order is kept for this tab (its token reads only that
   order), so a reload resumes it. Everything the page shows was checked first
   (src/lib/p2p/checkout.ts). */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { isPayer, recall, recallEmail, remember, rememberEmail } from '@/lib/app/remember';
import { fmt, useDocumentMeta, useI18n } from '@/i18n';
import { checkout } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { errorMessage, isNotFound } from '@/lib/api/messages';
import { savedOrder, saveOrder, type CheckoutCharge, type CheckoutOrder } from '@/lib/p2p/checkout';
import { accountRails, checkEmail, checkHolderName, checkPayerDocument } from '@/lib/p2p/rails';
import { countdown, isTerminal, msLeft, pollDelay } from '@/lib/p2p/orders';
import { dateTime, money, plainAmount } from '@/lib/format';
import { Logo } from '@/components/ui/Logo';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Field, Notice, SelectField, Skeleton, Spinner } from '@/components/ui/controls';
import { Icon } from '@/components/ui/Icon';
import { CopyRow, figureSize, useNow } from '@/components/ui/misc';
import { accountRows, errorText, railName } from '@/components/p2p/parts';
import { LangPicker, ThemeToggle } from '@/components/layout/SiteFrame';
import { useGuard } from '@/lib/use-action';

export default function ChargePage() {
  const { t, lang } = useI18n();
  const c = t.charge;
  useDocumentMeta(c.metaTitle, c.metaDescription);
  const { chargeId = '' } = useParams();
  const [charge, setCharge] = useState<CheckoutCharge | null | undefined>(undefined);
  const [loadError, setLoadError] = useState('');
  const [session, setSession] = useState<{ orderId: string; payerToken: string } | null>(() =>
    savedOrder(chargeId),
  );

  const load = useCallback(() => {
    setCharge(undefined);
    setLoadError('');
    checkout
      .charge(chargeId)
      .then(setCharge)
      .catch((e) => {
        if (isNotFound(e)) setCharge(null);
        else setLoadError(errorMessage(t.common, e, c.loadError));
      });
  }, [chargeId, t, c]);
  useEffect(load, [load]);

  const startAgain = () => {
    saveOrder(chargeId, null);
    setSession(null);
    load();
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-xl items-center justify-between px-6 py-4">
        <Link to="/" aria-label={t.common.nav.home} className="rounded-[10px]">
          <Logo size={20} />
        </Link>
        <div className="flex items-center gap-1">
          <LangPicker />
          <ThemeToggle />
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-xl flex-1 px-6 pb-16">
        {charge === undefined && !loadError && (
          <div className="slip flex flex-col gap-4 p-6" aria-busy="true">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="h-40" />
          </div>
        )}
        {loadError && (
          <div className="slip flex flex-col items-start gap-3 p-6">
            <Notice tone="error" stay>{loadError}</Notice>
            <button type="button" className="btn btn-line" onClick={load}>
              {t.common.actions.retry}
            </button>
          </div>
        )}
        {charge === null && (
          <div className="slip p-6">
            <Notice tone="warn">{c.notFound}</Notice>
          </div>
        )}
        {charge && (
          <article className="slip overflow-hidden" aria-labelledby="charge-h">
            <div className="px-5 pt-6 pb-5 sm:px-7">
              <p className="text-[0.9375rem] text-ink-3">
                {charge.payeeName ? fmt(c.payee, { payee: charge.payeeName }) : c.eyebrow}
              </p>
              <h1 id="charge-h" className="mt-2">
                <span className="sr-only">{c.toPay}: </span>
                <span
                  className={`figure block ${session ? 'text-[1.35rem]' : figureSize(money(lang, charge.fiatAmount, charge.currency))}`}
                >
                  {money(lang, charge.fiatAmount, charge.currency)}
                </span>
              </h1>
              {charge.description && <p className="mt-3 text-ink-2">{charge.description}</p>}
              {charge.expiresAt && charge.status === 'open' && !session && (
                <p className="mt-2 text-[0.875rem] text-ink-3">
                  {fmt(c.expiresAt, { date: dateTime(lang, charge.expiresAt) })}
                </p>
              )}
            </div>
            <div className="tear" />
            {session ? (
              <PayerOrder charge={charge} session={session} onStartAgain={startAgain} />
            ) : charge.status !== 'open' ? (
              <div className="px-5 pt-2 pb-6 sm:px-7">
                <Notice tone={charge.status === 'paid' ? 'ok' : 'warn'}>
                  {charge.status === 'paid'
                    ? c.status.requestPaid
                    : charge.status === 'expired'
                      ? c.status.requestExpired
                      : c.status.requestCancelled}
                </Notice>
              </div>
            ) : (
              <>
                <div className="mx-5 mt-2 flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-well p-4 sm:mx-7">
                  <div className="min-w-0">
                    <p className="font-semibold">{c.app.title}</p>
                    <p className="text-[0.875rem] text-ink-3">{c.app.body}</p>
                  </div>
                  <Link
                    to={`/app/charge/${encodeURIComponent(charge.id)}`}
                    className="btn btn-line btn-sm"
                  >
                    <Icon name="wallet" size={16} />
                    {c.app.cta}
                  </Link>
                </div>
                <PayerForm
                  charge={charge}
                  onOpened={(s) => {
                    saveOrder(chargeId, s);
                    setSession(s);
                  }}
                />
              </>
            )}
          </article>
        )}
        <p className="mt-6 flex items-start gap-2 px-1 text-[0.8125rem] text-ink-3">
          <Icon name="lock" size={16} className="mt-0.5 shrink-0" />
          {c.poweredBy}
        </p>
      </main>
    </div>
  );
}

function PayerForm({
  charge,
  onOpened,
}: {
  charge: CheckoutCharge;
  onOpened: (s: { orderId: string; payerToken: string }) => void;
}) {
  const { t } = useI18n();
  const c = t.charge;
  const p = t.p2p;
  const rails = accountRails(charge.rails);
  // Filled in as this device last sent them (src/lib/app/remember): the payer for this currency and
  // the email last used.
  const [form, setForm] = useState(() => {
    const known = recall(`payer.${charge.currency}`, isPayer);
    return {
      name: known?.name ?? '',
      document: known?.document ?? '',
      email: recallEmail() ?? '',
      rail: rails[0] ?? '',
    };
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const errors = {
    name: checkHolderName(form.name),
    document: checkPayerDocument(charge.currency, form.document),
    email: checkEmail(form.email),
  };
  const show = (k: keyof typeof errors) => (touched[k] ? errors[k] : null);
  const leave = (k: string) => () => setTouched((x) => ({ ...x, [k]: true }));

  const guard = useGuard();
  const submit = () =>
    guard(async () => {
      setTouched({ name: true, document: true, email: true });
      if (Object.values(errors).some(Boolean) || !form.rail) {
        setTimeout(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
        return;
      }
      setBusy(true);
      setError('');
      try {
        const { order, payerToken } = await checkout.open(charge.id, form);
        remember(`payer.${charge.currency}`, {
          name: form.name.trim(),
          document: form.document.trim(),
        });
        rememberEmail(form.email);
        onOpened({ orderId: order.id, payerToken });
      } catch (e) {
        setError(
          e instanceof ApiError && e.code === 'charge_busy'
            ? c.payer.busy
            : errorMessage(t.common, e, c.payer.failed),
        );
      } finally {
        setBusy(false);
      }
    });

  if (!rails.length)
    return (
      <div className="px-5 pt-2 pb-6 sm:px-7">
        <Notice tone="warn">{c.payer.noRails}</Notice>
      </div>
    );

  return (
    <form
      className="flex flex-col gap-4 px-5 pt-2 pb-6 sm:px-7"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      aria-labelledby="payer-h"
    >
      <div>
        <h2 id="payer-h" className="text-[1.2rem]">
          {c.payer.title}
        </h2>
        <p className="mt-1 text-[0.9375rem] text-ink-2">{c.payer.body}</p>
      </div>
      <Field
        label={c.payer.name}
        value={form.name}
        autoComplete="name"
        placeholder={p.placeholders.holderName}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        onBlur={leave('name')}
        error={errorText(p, 'holderName', show('name'))}
      />
      <Field
        label={c.payer.document}
        value={form.document}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => setForm({ ...form, document: e.target.value })}
        onBlur={leave('document')}
        error={errorText(p, 'document', show('document'))}
      />
      <Field
        label={c.payer.email}
        type="email"
        value={form.email}
        autoComplete="email"
        inputMode="email"
        hint={c.payer.emailHint}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        onBlur={leave('email')}
        error={errorText(p, 'text', show('email'))}
      />
      <SelectField
        label={c.payer.method}
        value={form.rail}
        onChange={(e) => setForm({ ...form, rail: e.target.value })}
        disabled={rails.length < 2}
        options={rails.map((r) => ({ value: r, label: railName(p, r) }))}
      />
      <button type="submit" className="btn btn-ink btn-lg mt-1 w-full" disabled={busy}>
        {busy && <Spinner />}
        {busy ? c.payer.submitting : c.payer.submit}
      </button>
      {error && <Notice tone="error">{error}</Notice>}
    </form>
  );
}

function PayerOrder({
  charge,
  session,
  onStartAgain,
}: {
  charge: CheckoutCharge;
  session: { orderId: string; payerToken: string };
  onStartAgain: () => void;
}) {
  const { t, lang } = useI18n();
  const c = t.charge;
  const p = t.p2p;
  const [order, setOrder] = useState<CheckoutOrder | null | undefined>(undefined);
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = () => {
      checkout
        .order(session.orderId, session.payerToken)
        .then((o) => {
          if (!alive) return;
          setOrder(o);
          const delay = pollDelay(o.status);
          if (delay) timer = setTimeout(read, document.hidden ? delay * 3 : delay);
        })
        .catch((e) => {
          if (!alive) return;
          if (isNotFound(e)) return setOrder(null);
          timer = setTimeout(read, 10_000);
        });
    };
    read();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [session]);

  const now = useNow(!!order && !isTerminal(order.status));
  const guard = useGuard();

  if (order === undefined || (order && order.status === 'pending'))
    return (
      <p className="flex items-center gap-3 px-5 pt-2 pb-6 text-ink-2 sm:px-7" role="status">
        <Spinner />
        {c.status.preparing}
      </p>
    );
  if (order === null)
    return (
      <div className="flex flex-col items-start gap-3 px-5 pt-2 pb-6 sm:px-7">
        <Notice tone="warn">{c.loadError}</Notice>
        <button type="button" className="btn btn-line" onClick={onStartAgain}>
          {c.startAgain}
        </button>
      </div>
    );

  const act = (action: 'paid' | 'cancel') =>
    guard(async () => {
      setBusy(true);
      setError('');
      try {
        setOrder(
          action === 'paid'
            ? await checkout.paid(order.id, session.payerToken, reference)
            : await checkout.cancel(order.id, session.payerToken),
        );
        setConfirmCancel(false);
      } catch (e) {
        setError(
          errorMessage(t.common, e, action === 'paid' ? c.transfer.failed : c.transfer.cancelFailed),
        );
      } finally {
        setBusy(false);
      }
    });

  if (order.status === 'awaiting_payment') {
    const left = msLeft(order.payBy, now);
    const total = 30 * 60_000;
    return (
      <div className="flex flex-col gap-1 px-5 pt-2 pb-6 sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[1.2rem]">{c.transfer.title}</h2>
          {order.payBy && (
            <p
              className="num inline-flex items-center gap-1.5 rounded-full bg-well px-3 py-1.5 text-[0.875rem] font-semibold"
              role="timer"
              aria-live="off"
            >
              <Icon name="clock" size={16} />
              {fmt(c.transfer.timeLeft, { time: countdown(left) })}
            </p>
          )}
        </div>
        <p className={`figure mt-3 ${figureSize(money(lang, order.fiatAmount, order.currency))}`}>
          <span className="marker marker-sweep">
            {money(lang, order.fiatAmount, order.currency)}
          </span>
        </p>
        {order.payBy && (
          <div
            className="mt-4 h-1.5 overflow-hidden rounded-full bg-well"
            role="progressbar"
            aria-label={c.transfer.timeBar}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(Math.min(1, left / total) * 100)}
          >
            <div
              className="h-full rounded-full bg-ink transition-[width] duration-1000 ease-linear"
              style={{ width: `${Math.min(100, (left / total) * 100)}%` }}
            />
          </div>
        )}
        <p className="mt-5 text-[0.9375rem] text-ink-2">{c.transfer.body}</p>
        {order.merchantName && (
          <p className="text-[0.875rem] text-ink-3">
            {fmt(c.settles, { merchant: order.merchantName })}
          </p>
        )}
        {order.paymentDetails && (
          <div className="mt-1 divide-y divide-line">
            {accountRows(p, order.paymentDetails).map(([k, v]) => (
              <CopyRow key={k} label={k} value={v} />
            ))}
            <CopyRow
              label={c.transfer.amount}
              value={plainAmount(order.fiatAmount, order.currency)}
              big
            />
          </div>
        )}
        <Field
          className="mt-3"
          label={c.transfer.reference}
          hint={c.transfer.referenceHint}
          value={reference}
          maxLength={60}
          autoComplete="off"
          onChange={(e) => setReference(e.target.value)}
        />
        <button
          type="button"
          className="btn btn-ink btn-lg mt-4 w-full"
          disabled={busy || left <= 0}
          onClick={() => void act('paid')}
        >
          {busy && <Spinner />}
          {busy ? c.transfer.sending : c.transfer.done}
        </button>
        <button
          type="button"
          className="btn btn-quiet btn-sm mt-2 self-start"
          disabled={busy}
          onClick={() => setConfirmCancel(true)}
        >
          {c.transfer.cancel}
        </button>
        {error && (
          <Notice tone="error" className="mt-2">
            {error}
          </Notice>
        )}
        {confirmCancel && (
          <ConfirmDialog
            title={c.transfer.cancelTitle}
            body={c.transfer.cancelBody}
            confirmLabel={c.transfer.cancel}
            danger
            busy={busy}
            onConfirm={() => void act('cancel')}
            onClose={() => setConfirmCancel(false)}
          />
        )}
      </div>
    );
  }

  const words: Record<string, [string, string, 'ok' | 'info' | 'warn']> = {
    paid: [c.status.paid, c.status.paidBody, 'info'],
    completed: [c.status.completed, c.status.completedBody, 'ok'],
    resolved: [c.status.completed, c.status.completedBody, 'ok'],
    expired: [c.status.expired, c.status.expiredBody, 'warn'],
    cancelled: [c.status.cancelled, c.status.cancelledBody, 'warn'],
    disputed: [c.status.disputed, c.status.disputedBody, 'info'],
    failed: [c.status.failed, c.status.failedBody, 'warn'],
  };
  const [title, body, tone] = words[order.status] ?? [
    (p.status as Record<string, string>)[order.status] ?? order.status,
    '',
    'info',
  ];
  const again =
    ['expired', 'cancelled', 'failed'].includes(order.status) && charge.status === 'open';
  return (
    <div className="flex flex-col items-start gap-3 px-5 pt-2 pb-6 sm:px-7" role="status">
      <div
        className={`flex w-full items-start gap-3 rounded-[16px] p-4 ${tone === 'ok' ? 'bg-ok-soft' : tone === 'warn' ? 'bg-well' : 'bg-info-soft'}`}
      >
        {tone === 'ok' ? (
          <Icon name="check" className="mt-0.5 shrink-0 text-ok" />
        ) : order.status === 'paid' ? (
          <Spinner className="mt-1 text-info" />
        ) : (
          <Icon name="info" className="mt-0.5 shrink-0" />
        )}
        <div>
          <h2 className="text-[1.15rem]">{title}</h2>
          {body && <p className="mt-1 text-ink-2">{body}</p>}
        </div>
      </div>
      {again && (
        <button type="button" className="btn btn-ink" onClick={onStartAgain}>
          {c.startAgain}
        </button>
      )}
    </div>
  );
}
