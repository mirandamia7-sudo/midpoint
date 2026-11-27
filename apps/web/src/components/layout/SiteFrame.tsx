/* The public site's frame: a header with the mark, the main sections, language, theme and the
   wallet; the footer. On a phone the sections fold into a menu. */
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { Logo } from '@/components/ui/Logo';
import { Icon } from '@/components/ui/Icon';
import { Address } from '@/components/ui/misc';
import { ConnectDialog } from '@/components/wallet/ConnectDialog';
import { LANGS, fmt, isLang, useI18n } from '@/i18n';
import { useTheme } from '@/lib/theme';
import { useSession } from '@/lib/session';

/** The language: the phone's own picker (a native select, invisible) over the site's quiet button,
    which shows the current language's code. */
export function LangPicker() {
  const { t, lang, setLang } = useI18n();
  return (
    <span className="btn btn-quiet btn-sm relative px-2.5 has-[select:focus-visible]:outline-2 has-[select:focus-visible]:outline-offset-2 has-[select:focus-visible]:outline-[var(--focus)]">
      <Icon name="globe" size={18} />
      <span className="font-semibold uppercase" aria-hidden="true">
        {lang}
      </span>
      <select
        className="absolute inset-0 size-full cursor-pointer appearance-none text-base opacity-0"
        value={lang}
        onChange={(e) => {
          if (isLang(e.target.value)) setLang(e.target.value);
        }}
        aria-label={t.common.lang.label}
      >
        {LANGS.map((code) => (
          <option key={code} value={code} lang={code}>
            {t.common.lang[code]}
          </option>
        ))}
      </select>
    </span>
  );
}

export function ThemeToggle() {
  const { t } = useI18n();
  const { dark, toggle } = useTheme();
  return (
    <button
      type="button"
      className="btn btn-quiet btn-sm px-2.5"
      onClick={toggle}
      aria-label={fmt(t.common.theme.toggle, {
        theme: dark ? t.common.theme.light : t.common.theme.dark,
      })}
    >
      <Icon name={dark ? 'sun' : 'moon'} size={18} />
    </button>
  );
}

export function WalletButton({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const { session, signOut } = useSession();
  const [open, setOpen] = useState(false);
  if (session === undefined) return <span className="skeleton block h-9 w-28" aria-hidden="true" />;
  if (!session)
    return (
      <>
        <button
          type="button"
          className={`btn btn-ink ${compact ? 'btn-sm' : 'btn-sm'}`}
          onClick={() => setOpen(true)}
        >
          <Icon name="wallet" size={18} />
          {t.common.wallet.connect}
        </button>
        {open && <ConnectDialog onClose={() => setOpen(false)} />}
      </>
    );
  return (
    <div className="flex items-center gap-1.5">
      <span className="sr-only">{t.common.wallet.account}</span>
      <Address value={session.address} />
      <button type="button" className="btn btn-quiet btn-sm px-2" onClick={() => void signOut()}>
        {t.common.wallet.signOut}
      </button>
    </div>
  );
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-3.5 py-2 font-semibold transition-colors duration-200 ${isActive ? 'text-ink bg-well' : 'text-ink-2 hover:text-ink'}`;

export function SiteHeader() {
  const { t } = useI18n();
  const n = t.common.nav;
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  useEffect(() => setMenu(false), [loc.pathname]);
  const links = [
    { to: '/app', label: n.app },
    { to: '/#merchants', label: n.merchants, plain: true },
    { to: '/#business', label: n.business, plain: true },
    { to: '/docs', label: n.docs },
    { to: '/dashboard', label: n.dashboard },
  ];
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-[color-mix(in_oklab,var(--paper)_88%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-6 sm:px-8">
        <Link to="/" aria-label={n.home} className="mr-2 rounded-[10px]">
          <Logo />
        </Link>
        <nav aria-label={n.label} className="hidden items-center gap-1 lg:flex">
          {links.map((l) =>
            l.plain ? (
              <a
                key={l.to}
                href={l.to}
                className="rounded-full px-3.5 py-2 font-semibold text-ink-2 transition-colors duration-200 hover:bg-well hover:text-ink"
              >
                {l.label}
              </a>
            ) : (
              <NavLink key={l.to} to={l.to} className={navClass}>
                {l.label}
              </NavLink>
            ),
          )}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <LangPicker />
          <ThemeToggle />
          <div className="hidden sm:block">
            <WalletButton />
          </div>
          <button
            type="button"
            className="btn btn-quiet btn-sm px-2 lg:hidden"
            aria-expanded={menu}
            aria-controls="site-menu"
            aria-label={menu ? n.closeMenu : n.menu}
            onClick={() => setMenu((m) => !m)}
          >
            <Icon name={menu ? 'close' : 'menu'} />
          </button>
        </div>
      </div>
      {menu && (
        <nav
          id="site-menu"
          aria-label={n.label}
          className="border-t border-line px-6 pb-4 lg:hidden"
        >
          <ul className="flex flex-col py-2" role="list">
            {links.map((l) => (
              <li key={l.to}>
                {l.plain ? (
                  <a
                    href={l.to}
                    onClick={() => setMenu(false)}
                    className="block rounded-[10px] px-3 py-3 text-[1.0625rem] font-semibold"
                  >
                    {l.label}
                  </a>
                ) : (
                  <NavLink
                    to={l.to}
                    className={({ isActive }) =>
                      `block rounded-[10px] px-3 py-3 text-[1.0625rem] font-semibold ${isActive ? 'bg-well' : ''}`
                    }
                  >
                    {l.label}
                  </NavLink>
                )}
              </li>
            ))}
          </ul>
          <div className="sm:hidden">
            <WalletButton />
          </div>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  const { t } = useI18n();
  const f = t.common.footer;
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 sm:px-8 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="flex max-w-sm flex-col gap-4">
          <Logo />
          <p className="text-[0.9375rem] text-ink-3">{f.about}</p>
          <p className="text-[0.875rem] text-ink-3">{f.status}</p>
        </div>
        <div>
          <h2 className="mb-3 text-[0.9375rem]">{f.product}</h2>
          <ul className="flex flex-col gap-2 text-ink-2" role="list">
            <li>
              <Link to="/app" className="hover:text-ink">
                {t.common.nav.app}
              </Link>
            </li>
            <li>
              <a href="/#merchants" className="hover:text-ink">
                {t.common.nav.merchants}
              </a>
            </li>
            <li>
              <a href="/#business" className="hover:text-ink">
                {t.common.nav.business}
              </a>
            </li>
            <li>
              <Link to="/dashboard" className="hover:text-ink">
                {t.common.nav.dashboard}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-[0.9375rem]">{f.developers}</h2>
          <ul className="flex flex-col gap-2 text-ink-2" role="list">
            <li>
              <Link to="/docs" className="hover:text-ink">
                {t.common.nav.docs}
              </Link>
            </li>
            <li>
              <Link to="/docs/quickstart-merchant" className="hover:text-ink">
                {f.quickstart}
              </Link>
            </li>
            <li>
              <Link to="/docs/security" className="hover:text-ink">
                {f.security}
              </Link>
            </li>
            <li>
              <Link to="/docs/api" className="hover:text-ink">
                {f.apiReference}
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

/** The public pages' layout. */
export function SiteLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-[10px] focus:bg-ink focus:px-4 focus:py-2 focus:text-on-ink"
      >
        {t.common.skip}
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
