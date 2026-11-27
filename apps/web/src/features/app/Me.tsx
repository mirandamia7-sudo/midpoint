/* Me: the @handle (change it), the address with copy, the network and wallet, the local currency
   (with its flag), language, theme, installing the app, the wallet provider's recovery and export
   (Pollar, when the wallet has them), the merchants' dashboard, and sign out. */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { fmt, useI18n } from '@/i18n';
import { Icon } from '@/components/ui/Icon';
import { LogoGlyph } from '@/components/ui/Logo';
import { CopyRow } from '@/components/ui/misc';
import { CurrencyMark } from '@/components/p2p/parts';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { LangPicker, ThemeToggle } from '@/components/layout/SiteFrame';
import { shortAddress } from '@/lib/format';
import { install, usePwa } from '@/lib/pwa';
import { useSession } from '@/lib/session';
import { useAppData } from '@/features/app/data';
import { Screen } from '@/features/app/shell';
import { useCurrencyPicker } from '@/features/app/parts';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[56px] items-center justify-between gap-4 py-2">
      <span className="text-ink-2">{label}</span>
      <span className="flex items-center gap-2 text-right font-semibold">{children}</span>
    </div>
  );
}

export default function Me() {
  const { t } = useI18n();
  const m = t.app.me;
  const navigate = useNavigate();
  const { session, wallet, signOut } = useSession();
  const { profile, network } = useAppData();
  const pwa = usePwa();
  const [leaving, setLeaving] = useState(false);
  const picker = useCurrencyPicker();

  return (
    <Screen title={m.title} width="page">
      <div className="grid gap-6 pb-6 lg:grid-cols-2 lg:items-start lg:gap-8">
        <div className="flex flex-col gap-6">
          {/* Who I am, as a wallet card: the aura from ice to night. */}
          <section className="tone-dark aura-card grain flex min-h-[208px] flex-col overflow-hidden rounded-[24px] p-5 text-ink shadow-[var(--shadow-float)]">
            <div className="flex items-start justify-between gap-3">
              <span
                className="grid size-12 shrink-0 place-items-center rounded-full bg-white text-[1.25rem] font-bold text-[#0a0b0e] uppercase"
                aria-hidden="true"
              >
                {profile?.handle ? (
                  profile.handle.slice(0, 1)
                ) : (
                  <Icon name="user" size={20} strokeWidth={2.2} />
                )}
              </span>
              <Link to="/app/handle" className="btn btn-white btn-sm">
                {profile?.handle ? m.change : m.choose}
              </Link>
            </div>
            <div className="mt-auto pt-10">
              <p className="text-[0.8125rem] text-ink-2">{m.handle}</p>
              <p className="truncate text-[1.6rem] leading-tight font-semibold tracking-[-0.02em]">
                {profile?.handle ? `@${profile.handle}` : m.noHandle}
              </p>
              <div className="mt-2 flex items-center justify-between gap-3 text-ink-2">
                <span className="num text-[0.9375rem]">
                  {session ? shortAddress(session.address) : ''}
                </span>
                <LogoGlyph size={22} className="text-ink" />
              </div>
            </div>
          </section>

          <div className="sheet divide-y divide-line px-5">
            {session && <CopyRow label={m.address} value={session.address} />}
            <Row label={m.network}>{network?.name ?? '-'}</Row>
            <Row label={m.wallet}>{wallet?.label ?? '-'}</Row>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="sheet divide-y divide-line px-5">
            <Row label={m.currency}>
              <button
                type="button"
                className="flex items-center gap-2 rounded-full border border-line py-1.5 pr-3 pl-1.5 transition-[border-color,transform] duration-200 hover:border-ink active:scale-[0.97]"
                onClick={picker.open}
                aria-haspopup="dialog"
                aria-label={picker.label}
                disabled={picker.choices < 2}
              >
                <CurrencyMark code={picker.currency} size={26} />
                <span>{picker.currency}</span>
                {picker.choices > 1 && <Icon name="chevron" size={16} />}
              </button>
            </Row>
            <Row label={m.language}>
              <LangPicker />
            </Row>
            <Row label={m.theme}>
              <ThemeToggle />
            </Row>
          </div>

          <section className="sheet px-5 py-4">
            <h2 className="text-[1.05rem]">{m.install}</h2>
            {pwa.installed ? (
              <p className="mt-1 text-ink-3">{m.installed}</p>
            ) : pwa.canInstall ? (
              <>
                <p className="mt-1 text-ink-3">{m.installBody}</p>
                <button type="button" className="btn btn-ink mt-3" onClick={() => void install()}>
                  <Icon name="download" size={18} />
                  {t.app.pwa.install}
                </button>
              </>
            ) : (
              <p className="mt-1 text-ink-3">{pwa.iosHint ? m.iosHint : m.installBody}</p>
            )}
          </section>

          {wallet?.openRecovery && (
            <button
              type="button"
              className="sheet lift flex min-h-[64px] items-center gap-3 px-5 text-left"
              onClick={wallet.openRecovery}
            >
              <Icon name="key" size={22} />
              <span className="flex flex-1 flex-col">
                <b>{m.recovery}</b>
                <span className="text-[0.875rem] text-ink-3">{m.recoveryBody}</span>
              </span>
              <Icon name="chevronRight" size={18} className="chev" />
            </button>
          )}

          <Link to="/dashboard" className="sheet lift flex min-h-[60px] items-center gap-3 px-5">
            <Icon name="grid" size={22} />
            <span className="flex-1 font-semibold">{m.dashboard}</span>
            <Icon name="chevronRight" size={18} className="chev" />
          </Link>

          <button
            type="button"
            className="btn btn-line btn-lg text-bad"
            onClick={() => setLeaving(true)}
          >
            {m.signOut}
          </button>
        </div>
      </div>
      {picker.sheet}
      {leaving && (
        <ConfirmDialog
          title={m.signOut}
          body={fmt(m.signOutConfirm, { brand: t.common.brand })}
          confirmLabel={m.signOut}
          danger
          onConfirm={async () => {
            await signOut();
            setLeaving(false);
            navigate('/app', { replace: true });
          }}
          onClose={() => setLeaving(false)}
        />
      )}
    </Screen>
  );
}
