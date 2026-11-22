/* The payments app's frame. On a phone: one column, safe-area insets and the floating dock with
   the scan button in the middle. From a tablet up (768px): a side navigation and the screens in a
   wider centred column; on a tablet the navigation is a rail of icons (88px), from a laptop up
   (1024px) it has the logo and the labels (260px). Every screen comes in with a short motion
   (forward from the right, back from the left, a tab switch fades); the banners for no
   connection and a new version. Also the screen header with a back button, and the home's action
   tiles. */
import { useEffect, useRef, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate, useNavigationType } from 'react-router';
import { useI18n } from '@/i18n';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Logo, LogoGlyph } from '@/components/ui/Logo';
import { applyUpdate, usePwa } from '@/lib/pwa';

export const TAB_PATHS = ['/app', '/app/activity', '/app/receive', '/app/me'];
const clean = (path: string) => path.replace(/\/+$/, '') || '/app';

/** How the new screen moves in: between tabs it fades, going back it comes from the left, any
    other step forward from the right. */
function useScreenMotion(pathname: string): 'fade' | 'forward' | 'back' {
  const type = useNavigationType();
  const prev = useRef(pathname);
  const from = prev.current;
  useEffect(() => {
    prev.current = pathname;
  }, [pathname]);
  if (from === pathname) return 'fade';
  if (TAB_PATHS.includes(clean(from)) && TAB_PATHS.includes(clean(pathname))) return 'fade';
  if (type === 'POP') return 'back';
  return type === 'REPLACE' ? 'fade' : 'forward';
}

export function AppFrame({
  children,
  tabs,
  nav,
}: {
  children: ReactNode;
  /* The phone's dock (the four tab screens). */
  tabs: boolean;
  /* Signed in: the side navigation on every screen from a tablet up. */
  nav: boolean;
}) {
  const { t } = useI18n();
  const pwa = usePwa();
  const { pathname } = useLocation();
  const motion = useScreenMotion(pathname);
  return (
    <div className="app-backdrop min-h-dvh">
      {nav && <SideNav />}
      <div
        className={`app-column relative mx-auto flex min-h-dvh w-full max-w-[460px] flex-col bg-paper md:w-auto md:max-w-none ${nav ? 'md:ml-[88px] lg:ml-[260px]' : 'md:mx-0'}`}
      >
        <div className="app-top-inset" />
        {!pwa.online && (
          <p
            className="bg-warn-soft px-4 py-2 text-center text-[0.875rem] font-semibold text-warn"
            role="status"
          >
            {t.app.pwa.offline}
          </p>
        )}
        {pwa.updateReady && (
          <div
            className="flex items-center justify-between gap-3 bg-info-soft px-4 py-2 text-[0.875rem] text-info"
            role="status"
          >
            <span className="font-semibold">{t.app.pwa.update}</span>
            <button type="button" className="btn btn-sm btn-line" onClick={applyUpdate}>
              {t.app.pwa.reload}
            </button>
          </div>
        )}
        <main
          id="main"
          className={`flex flex-1 flex-col ${tabs ? 'app-with-tabs' : 'app-without-tabs'}`}
        >
          <div key={pathname} data-motion={motion} className="screen flex w-full flex-1 flex-col">
            {children}
          </div>
        </main>
        {tabs && <TabBar />}
      </div>
    </div>
  );
}

function Tab({
  to,
  icon,
  label,
  end,
}: {
  to: string;
  icon: IconName;
  label: string;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      aria-label={label}
      title={label}
      className={({ isActive }) =>
        `grid size-12 place-items-center rounded-full transition-[background-color,color,transform] duration-200 active:scale-90 ${isActive ? 'tab-on bg-well text-ink' : 'text-ink-3 hover:text-ink'}`
      }
    >
      {({ isActive }) => <Icon name={icon} size={22} strokeWidth={isActive ? 2.3 : 1.9} />}
    </NavLink>
  );
}

/** The tabs on a phone: one floating pill, the scan button at its centre. */
export function TabBar() {
  const { t } = useI18n();
  const tb = t.app.tabs;
  return (
    <nav
      aria-label={tb.label}
      className="app-dock fixed left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full p-1.5 md:hidden"
    >
      <Tab to="/app" end icon="home" label={tb.home} />
      <Tab to="/app/activity" icon="list" label={tb.activity} />
      <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />
      <NavLink
        to="/app/scan"
        aria-label={tb.scan}
        title={tb.scan}
        className="grid size-[52px] place-items-center rounded-full bg-ink text-on-ink transition-transform duration-150 active:scale-90"
      >
        <Icon name="scan" size={24} strokeWidth={2.2} />
      </NavLink>
      <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />
      <Tab to="/app/receive" icon="qr" label={tb.receive} />
      <Tab to="/app/me" icon="user" label={tb.me} />
    </nav>
  );
}

function SideLink({
  to,
  icon,
  label,
  end,
}: {
  to: string;
  icon: IconName;
  label: string;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      title={label}
      className={({ isActive }) =>
        `flex size-12 items-center justify-center gap-3 rounded-full font-semibold transition-[background-color,color,transform] duration-200 active:scale-[0.98] lg:h-auto lg:min-h-12 lg:w-auto lg:justify-start lg:px-4 ${isActive ? 'tab-on bg-well text-ink' : 'text-ink-2 hover:bg-well hover:text-ink'}`
      }
    >
      <Icon name={icon} size={20} />
      {/* The rail shows the icon alone; the label is still the link's name. */}
      <span className="sr-only lg:not-sr-only">{label}</span>
    </NavLink>
  );
}

/** The tabs from a tablet up: a side navigation with the logo, the scan button below. On a tablet
    it is a rail: the cut M, the icons and a round scan button. */
function SideNav() {
  const { t } = useI18n();
  const tb = t.app.tabs;
  return (
    <nav
      aria-label={tb.label}
      className="fixed inset-y-0 left-0 z-20 hidden w-[88px] flex-col items-center gap-1 border-r border-line bg-sheet px-3 py-6 md:flex lg:w-[260px] lg:items-stretch lg:px-4"
    >
      <Link
        to="/app"
        className="mb-8 grid min-h-9 place-items-center rounded-[10px] lg:self-start lg:px-3"
        aria-label={tb.home}
      >
        <LogoGlyph size={24} className="text-ink lg:hidden" />
        <Logo size={22} className="hidden text-ink lg:block" />
      </Link>
      <SideLink to="/app" end icon="home" label={tb.home} />
      <SideLink to="/app/activity" icon="list" label={tb.activity} />
      <SideLink to="/app/receive" icon="qr" label={tb.receive} />
      <SideLink to="/app/me" icon="user" label={tb.me} />
      <NavLink
        to="/app/scan"
        className="btn btn-ink btn-icon mt-6 size-12 lg:hidden"
        aria-label={tb.scan}
        title={tb.scan}
      >
        <Icon name="scan" size={20} strokeWidth={2.2} />
      </NavLink>
      <NavLink to="/app/scan" className="btn btn-ink btn-lg mt-6 hidden lg:inline-flex">
        <Icon name="scan" size={20} strokeWidth={2.2} />
        {tb.scan}
      </NavLink>
    </nav>
  );
}

/** A screen: its header (back, title, an optional action) and its body. On a phone it spans the
    column inside 24px gutters; from a tablet up it is a page with 40px gutters, up to 720px wide
    for a form (`width="form"`, the default) or 1180px for a page with columns (`width="page"`).
    A form with an `aside` (the wallet's balance, say) shows it beside the form from 1280px. */
export function Screen({
  title,
  back,
  action,
  children,
  wide = false,
  width = 'form',
  aside,
}: {
  title?: ReactNode;
  /* Where back goes: a path, or true for the previous screen. */
  back?: string | true;
  action?: ReactNode;
  children: ReactNode;
  wide?: boolean;
  width?: 'form' | 'page';
  aside?: ReactNode;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const goBack = () => {
    if (back === true) {
      if (location.key !== 'default') navigate(-1);
      else navigate('/app');
    } else if (back) navigate(back);
  };
  return (
    <div
      className={`flex flex-1 flex-col md:mx-auto md:w-full md:pb-6 ${width === 'page' ? 'md:max-w-[1180px]' : aside ? 'md:max-w-[720px] xl:max-w-[1120px]' : 'md:max-w-[720px]'} ${wide ? '' : 'px-6 md:px-10'}`}
    >
      {(title || back || action) && (
        <header
          className={`flex min-h-[64px] items-center gap-3 pt-2 pb-2 md:min-h-[72px] md:pt-8 md:pb-4 ${wide ? 'px-6 md:px-10' : ''}`}
        >
          {back && (
            <button
              type="button"
              className="btn btn-quiet btn-icon -ml-1.5 bg-sheet shadow-[var(--shadow-sheet)]"
              onClick={goBack}
              aria-label={t.app.back}
            >
              <Icon name="back" size={20} />
            </button>
          )}
          {title && <h1 className="flex-1 truncate text-[1.375rem] md:text-[2rem]">{title}</h1>}
          {!title && <span className="flex-1" />}
          {action}
        </header>
      )}
      {aside ? (
        <div className="flex flex-1 flex-col xl:grid xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start xl:gap-10">
          <div className="flex min-w-0 flex-1 flex-col">{children}</div>
          <aside className="hidden xl:sticky xl:top-8 xl:block">{aside}</aside>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

/** An action on the aura (the home screen's send, receive, add, withdraw): a pale tile with a
    black icon tile and a tracked capital label. */
export function ActionTile({ to, icon, label }: { to: string; icon: IconName; label: string }) {
  return (
    <NavLink to={to} className="tile md:min-h-[108px] md:p-4">
      <span className="tile-icon" aria-hidden="true">
        <Icon name={icon} size={16} strokeWidth={2.3} />
      </span>
      <span className="caps truncate">{label}</span>
    </NavLink>
  );
}
