/* Welcome, sign-up and sign-in. The welcome sits on the aura over the whole screen: the mark's
   slid M drawn large in the ice, then, where the aura turns to night, what the app is for and two
   ways in (create an account, sign in). Each opens a plain page with the form (src/components/
   wallet/SignIn.tsx).

   - A phone: one column, the aura over the whole welcome.
   - A tablet (768px): the phone's layout with its words and form centred, no wider than they read
     well.
   - From a laptop up (1024px): split in two, the aura with the slid M on the left and the words or
     the form centred in the right column.

   The screen stays on the route the person was going to, so after signing in they land there (a
   payment link opens the send screen). */
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useI18n } from '@/i18n';
import { Logo, LogoGlyph } from '@/components/ui/Logo';
import { Icon } from '@/components/ui/Icon';
import { SignIn, type AuthMode } from '@/components/wallet/SignIn';
import { LangToggle, ThemeToggle } from '@/components/layout/SiteFrame';
import { useSession } from '@/lib/session';
import { useClearErrors } from '@/components/ui/Toast';

export default function Welcome() {
  const { expired } = useSession();
  // A session that ended opens on the sign-in (its form says so). The errors it caused on the
  // screen left behind ("could not load your balance") are not this screen's: they go.
  const [mode, setMode] = useState<AuthMode | null>(expired ? 'signin' : null);
  const clearErrors = useClearErrors();
  useEffect(() => {
    if (expired) clearErrors();
  }, [expired, clearErrors]);
  if (mode) return <Auth mode={mode} onMode={setMode} onBack={() => setMode(null)} />;
  return <Intro onMode={setMode} />;
}

/** The two columns from a laptop up: the aura, then the words or the form (never wider than
    640px). */
const SPLIT =
  'lg:grid lg:flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(460px,560px)] xl:grid-cols-[minmax(0,1fr)_640px]';

/** The aura half of the welcome on a wide screen: the logo and the slid M, large. It stays in
    view while a long form scrolls; the frame's bottom padding is its bottom margin, so the two
    columns fit the screen. */
function AuraPanel() {
  return (
    <div className="aura-screen grain m-4 hidden flex-col overflow-hidden rounded-[32px] p-10 lg:sticky lg:top-4 lg:mb-0 lg:flex lg:h-[calc(100dvh-32px)]">
      <div className="tone-light text-ink">
        <Logo size={24} />
      </div>
      <div className="flex flex-1 items-center justify-center text-[#0a0b0e]">
        <LogoGlyph size={220} className="h-auto w-[min(72%,320px)]" />
      </div>
    </div>
  );
}

function Intro({ onMode }: { onMode: (m: AuthMode) => void }) {
  const { t } = useI18n();
  const w = t.app.welcome;
  const a = t.common.wallet;
  return (
    <>
      {/* From a laptop up: the aura beside the words. */}
      <div className={`hidden ${SPLIT}`}>
        <AuraPanel />
        <div className="flex flex-col px-12 py-8 xl:px-16">
          <div className="flex justify-end gap-1">
            <LangToggle />
            <ThemeToggle />
          </div>
          <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col justify-center py-10">
            <h1 className="display text-[clamp(2.4rem,3.6vw,3.5rem)]">{w.title}</h1>
            <p className="mt-5 text-[1.125rem] text-ink-2">{w.lede}</p>
            <div className="mt-10 flex flex-col gap-3">
              <button type="button" className="btn btn-ink btn-lg" onClick={() => onMode('signup')}>
                {a.createAccount}
              </button>
              <button
                type="button"
                className="btn btn-line btn-lg"
                onClick={() => onMode('signin')}
              >
                {a.signIn}
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* A phone or a tablet: the aura runs to the screen's foot (it takes back the frame's bottom
          padding); on a tablet the words keep a phone's measure, centred. */}
      <div className="aura-screen grain mb-[calc(-16px-env(safe-area-inset-bottom,0px))] flex flex-1 flex-col pb-[calc(28px+env(safe-area-inset-bottom,0px))] md:pb-14 lg:hidden">
        <div className="tone-light flex items-center justify-between px-6 pt-3 text-ink md:px-10 md:pt-6">
          <Logo size={20} />
          <span className="flex items-center gap-1">
            <LangToggle />
            <ThemeToggle />
          </span>
        </div>

        <div className="flex min-h-[200px] flex-1 items-center justify-center text-[#0a0b0e]">
          <LogoGlyph size={136} className="md:h-[200px] md:w-auto" />
        </div>

        <div className="tone-dark mx-auto flex w-full max-w-[520px] flex-col px-6 text-ink">
          <h1 className="display text-[clamp(2rem,10vw,2.7rem)] md:text-[3rem]">{w.title}</h1>
          <p className="mt-3 text-[1.0625rem] text-ink-2">{w.lede}</p>
          <div className="mt-8 flex flex-col gap-2">
            <button
              type="button"
              className="btn btn-white btn-lg w-full"
              onClick={() => onMode('signup')}
            >
              {a.createAccount}
            </button>
            <button
              type="button"
              className="btn btn-quiet btn-lg w-full text-ink"
              onClick={() => onMode('signin')}
            >
              {a.signIn}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Auth({
  mode,
  onMode,
  onBack,
}: {
  mode: AuthMode;
  onMode: (m: AuthMode) => void;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const a = t.common.wallet;
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const signup = mode === 'signup';
  return (
    <div className={`flex flex-1 flex-col ${SPLIT}`}>
      <AuraPanel />
      <div className="flex flex-1 flex-col px-6 pt-3 md:px-10 md:pt-6 lg:px-12 lg:py-8 xl:px-16">
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="btn btn-quiet btn-icon -ml-1.5 bg-sheet shadow-[var(--shadow-sheet)]"
            onClick={onBack}
            aria-label={t.app.back}
          >
            <Icon name="back" size={20} />
          </button>
          <span className="flex items-center gap-1">
            <LangToggle />
            <ThemeToggle />
          </span>
        </div>
        {/* A phone: the form at the top and the way to the other mode at the foot. From a tablet
            up: both together, centred. */}
        <div className="flex flex-1 flex-col md:mx-auto md:w-full md:max-w-[420px] md:justify-center md:py-12">
          <div className="mt-8 md:mt-0">
            <LogoGlyph size={40} className="text-ink" />
          </div>
          <h1 className="mt-5 text-[1.875rem]">{signup ? a.signUpTitle : a.signInTitle}</h1>
          <p className="mt-2 text-ink-2">{signup ? a.signUpBody : a.signInBody}</p>
          <div className="mt-7">
            {/* A new instance per mode: switching starts the form over. */}
            <SignIn
              key={mode}
              variant="app"
              mode={mode}
              onSignedIn={() => {
                if (pathname.replace(/\/+$/, '') === '/app/welcome')
                  navigate('/app', { replace: true });
              }}
            />
          </div>
          <p className="mt-auto pt-10 pb-2 text-center text-ink-2 md:mt-8 md:pt-0 md:pb-0 md:text-left">
            {signup ? a.haveAccount : a.noAccount}{' '}
            <button
              type="button"
              className="font-semibold text-ink underline underline-offset-4"
              onClick={() => onMode(signup ? 'signin' : 'signup')}
            >
              {signup ? a.signIn : a.createAccount}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
