/* The merchant / business dashboard (/dashboard/*): signed in with a Stellar wallet (SEP-10),
   scoped to one organization and one tier (test or live). A sidebar on wide screens, a sheet of sections on
   phones; the market views, charges and payouts, the developer tools and the team. */
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router';
import { useDocumentMeta, useI18n } from '@/i18n';
import { sessionGate, useSession } from '@/lib/session';
import { orgs as orgsApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/messages';
import { Logo } from '@/components/ui/Logo';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Field, Notice, Spinner } from '@/components/ui/controls';
import { Address } from '@/components/ui/misc';
import { useToast } from '@/components/ui/Toast';
import { SignIn } from '@/components/wallet/SignIn';
import { LangPicker, ThemeToggle } from '@/components/layout/SiteFrame';
import { DashProvider, useDash } from '@/features/dashboard/context';
import { OverviewView } from '@/features/dashboard/views/OverviewView';
import { LiquidityView } from '@/features/dashboard/views/LiquidityView';
import { OffersView } from '@/features/dashboard/views/OffersView';
import { MethodsView } from '@/features/dashboard/views/MethodsView';
import { OrdersView } from '@/features/dashboard/views/OrdersView';
import { ChargesView } from '@/features/dashboard/views/ChargesView';
import { PayoutsView } from '@/features/dashboard/views/PayoutsView';
import { KeysView } from '@/features/dashboard/views/KeysView';
import { WebhooksView } from '@/features/dashboard/views/WebhooksView';
import { TeamView } from '@/features/dashboard/views/TeamView';
import { useGuard } from '@/lib/use-action';

type Section = {
  path: string;
  key: keyof ReturnType<typeof useI18n>['t']['dash']['nav'];
  icon: IconName;
};
const GROUPS: { key: 'market' | 'money' | 'developers' | 'org'; items: Section[] }[] = [
  {
    key: 'market',
    items: [
      { path: 'overview', key: 'overview', icon: 'grid' },
      { path: 'liquidity', key: 'liquidity', icon: 'coins' },
      { path: 'offers', key: 'offers', icon: 'tag' },
      { path: 'methods', key: 'methods', icon: 'bank' },
      { path: 'orders', key: 'orders', icon: 'list' },
    ],
  },
  {
    key: 'money',
    items: [
      { path: 'charges', key: 'charges', icon: 'qr' },
      { path: 'payouts', key: 'payouts', icon: 'send' },
    ],
  },
  {
    key: 'developers',
    items: [
      { path: 'keys', key: 'keys', icon: 'key' },
      { path: 'webhooks', key: 'webhooks', icon: 'hook' },
    ],
  },
  { key: 'org', items: [{ path: 'team', key: 'team', icon: 'users' }] },
];

export default function DashboardApp() {
  const { t } = useI18n();
  useDocumentMeta(t.dash.metaTitle);
  const auth = useSession();
  const { session, refresh } = auth;
  const gate = sessionGate(auth);
  if (gate === 'loading')
    return (
      <div className="flex min-h-dvh items-center justify-center gap-3 text-ink-3" role="status">
        <Spinner />
        {t.dash.state.loading}
      </div>
    );
  // Without a session, or one that could not be renewed silently: the sign-in.
  if (gate === 'signin' || !session) return <SignInGate />;
  if (!session.organizations.length) return <CreateOrg onCreated={() => void refresh()} />;
  return (
    <DashProvider orgs={session.organizations}>
      <Shell />
    </DashProvider>
  );
}

function Bare({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4 sm:px-8">
        <Link to="/" aria-label={t.common.nav.home}>
          <Logo />
        </Link>
        <div className="flex items-center gap-1">
          <LangPicker />
          <ThemeToggle />
        </div>
      </header>
      <main
        id="main"
        className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 pb-24"
      >
        {children}
      </main>
    </div>
  );
}

function SignInGate() {
  const { t } = useI18n();
  return (
    <Bare>
      <div className="sheet mx-auto flex w-full max-w-md flex-col gap-2 p-6 sm:p-8">
        <h1 className="text-[1.75rem]">{t.dash.signIn.title}</h1>
        <p className="mb-4 text-ink-2">{t.dash.signIn.body}</p>
        <SignIn variant="dashboard" mode="signin" />
        <Link to="/" className="btn btn-quiet mt-2 self-center">
          {t.dash.signIn.back}
        </Link>
      </div>
    </Bare>
  );
}

function CreateOrg({ onCreated }: { onCreated: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const valid = name.trim().length >= 2 && name.trim().length <= 60;
  const guard = useGuard();
  return (
    <Bare>
      <form
        className="sheet flex flex-col gap-4 p-6 sm:p-8"
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (!valid) return;
          // One organization per tap: a second submit while it is being made is dropped.
          void guard(async () => {
            setBusy(true);
            setError('');
            try {
              await orgsApi.create(name.trim());
              toast(t.dash.orgs.created);
              onCreated();
            } catch (err) {
              setError(errorMessage(t.common, err));
            } finally {
              setBusy(false);
            }
          });
        }}
      >
        <h1 className="text-[1.75rem]">{t.dash.orgs.createTitle}</h1>
        <p className="text-ink-2">{t.dash.orgs.createBody}</p>
        <Field
          label={t.dash.orgs.name}
          value={name}
          placeholder={t.dash.orgs.namePlaceholder}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched(true)}
          error={touched && !valid ? t.dash.orgs.nameError : null}
          maxLength={60}
        />
        <button type="submit" className="btn btn-ink btn-lg" disabled={busy}>
          {busy && <Spinner />}
          {busy ? t.dash.orgs.creating : t.dash.orgs.create}
        </button>
        {error && <Notice tone="error">{error}</Notice>}
      </form>
    </Bare>
  );
}

function Shell() {
  const { t } = useI18n();
  const d = t.dash;
  const { tier } = useDash();
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  useEffect(() => setMenu(false), [loc.pathname]);
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-[10px] focus:bg-ink focus:px-4 focus:py-2 focus:text-on-ink"
      >
        {t.common.skip}
      </a>
      <div className="flex flex-1">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-sheet lg:flex">
          <SideNav />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-[color-mix(in_oklab,var(--paper)_90%,transparent)] px-6 py-3 backdrop-blur-md lg:hidden">
            <Link to="/dashboard" aria-label={t.common.nav.home}>
              <Logo size={20} />
            </Link>
            <button
              type="button"
              className="btn btn-quiet btn-sm px-2"
              aria-expanded={menu}
              aria-controls="dash-menu"
              aria-label={menu ? d.nav.close : d.nav.menu}
              onClick={() => setMenu((m) => !m)}
            >
              <Icon name={menu ? 'close' : 'menu'} />
            </button>
          </header>
          {menu && (
            <div id="dash-menu" className="border-b border-line bg-sheet lg:hidden">
              <SideNav />
            </div>
          )}
          {tier === 'test' && (
            <p className="border-b border-line bg-warn-soft px-4 py-2 text-[0.875rem] font-semibold text-warn sm:px-8">
              {d.tier.testBanner}
            </p>
          )}
          <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-6 py-8 sm:px-8">
            <Routes>
              <Route index element={<Navigate to="overview" replace />} />
              <Route path="overview" element={<OverviewView />} />
              <Route path="liquidity" element={<LiquidityView />} />
              <Route path="offers" element={<OffersView />} />
              <Route path="methods" element={<MethodsView />} />
              <Route path="orders" element={<OrdersView />} />
              <Route path="charges" element={<ChargesView />} />
              <Route path="payouts" element={<PayoutsView />} />
              <Route path="keys" element={<KeysView />} />
              <Route path="webhooks" element={<WebhooksView />} />
              <Route path="team" element={<TeamView />} />
              <Route path="*" element={<Navigate to="overview" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
}

function SideNav() {
  const { t } = useI18n();
  const d = t.dash;
  const { org, orgs, setOrg, tier, setTier } = useDash();
  const { session, signOut } = useSession();
  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-4">
      <Link to="/" className="hidden px-1 lg:block" aria-label={d.nav.site}>
        <Logo />
      </Link>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="dash-org" className="px-1 text-[0.8125rem] font-semibold text-ink-3">
          {d.orgs.label}
        </label>
        <select
          id="dash-org"
          className="field min-h-11 py-2"
          value={org.id}
          onChange={(e) => setOrg(e.target.value)}
        >
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} ({d.orgs.roles[o.role]})
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <span id="dash-tier" className="px-1 text-[0.8125rem] font-semibold text-ink-3">
          {d.tier.label}
        </span>
        <div className="seg" role="group" aria-labelledby="dash-tier">
          {(['test', 'live'] as const).map((x) => (
            <button key={x} type="button" aria-pressed={tier === x} onClick={() => setTier(x)}>
              {d.tier[x]}
            </button>
          ))}
        </div>
      </div>
      <nav aria-label={d.nav.label} className="flex flex-col gap-4">
        {GROUPS.map((g) => (
          <div key={g.key}>
            <p className="mb-1 px-3 text-[0.8125rem] font-semibold text-ink-3">
              {d.nav.groups[g.key]}
            </p>
            <ul className="flex flex-col" role="list">
              {g.items.map((s) => (
                <li key={s.path}>
                  <NavLink
                    to={`/dashboard/${s.path}`}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-[10px] px-3 py-2 font-semibold transition-colors ${isActive ? 'bg-well text-ink' : 'text-ink-2 hover:text-ink'}`
                    }
                  >
                    <Icon name={s.icon} size={18} />
                    {d.nav[s.key] as string}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-2 border-t border-line pt-4">
        {session && (
          <div className="flex items-center justify-between gap-2">
            <Address value={session.address} />
            <button
              type="button"
              className="btn btn-quiet btn-sm px-2"
              onClick={() => void signOut()}
            >
              {t.common.wallet.signOut}
            </button>
          </div>
        )}
        <div className="flex items-center gap-1">
          <LangPicker />
          <ThemeToggle />
          <Link to="/" className="btn btn-quiet btn-sm ml-auto px-2">
            {d.nav.site}
          </Link>
        </div>
      </div>
    </div>
  );
}
