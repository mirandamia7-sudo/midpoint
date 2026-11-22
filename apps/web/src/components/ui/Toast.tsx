/* Short messages after an action: a confirmation ("Offer saved"), a note ("The price was updated")
   or an error. Every error a screen shows also comes up here (Notice raises it), so a failure is
   seen wherever the person is looking; the screen keeps its own line next to what failed.

   - On a phone they come down from the top like a notification and go back up; a swipe up sends
     one away. From a tablet up (768px) they stack in the top right corner, in and out from the
     right edge; a swipe to the right sends one away.
   - The newest is on top. At most three are on screen (src/components/ui/toast-model.ts).
   - They live in the browser's top layer (a manual popover), so they show above an open dialog.
   - The same message is not repeated while it is on screen, nor within a few seconds after.
   - Tapping one dismisses it. An error stays longer than a confirmation.
   - A screen that replaces the one that failed can clear its errors (`useClearErrors`): the
     sign-in after a session ended does. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { queued, swipeEnd, swipeShift } from '@/components/ui/toast-model';

export type ToastTone = 'ok' | 'info' | 'error';
type Toast = { id: number; text: string; tone: ToastTone; silent: boolean; leaving: boolean };
type Push = (text: string, tone?: ToastTone, opts?: { silent?: boolean }) => void;

const Ctx = createContext<Push>(() => {});
const ClearCtx = createContext<() => void>(() => {});

const LIFE: Record<ToastTone, number> = { ok: 3200, info: 4800, error: 6500 };
const ICON: Record<ToastTone, IconName> = { ok: 'check', info: 'info', error: 'alert' };
const LOOK: Record<ToastTone, string> = {
  ok: 'bg-ink text-on-ink',
  info: 'bg-ink text-on-ink',
  error: 'bg-bad text-white',
};
/** A message shown this recently is not shown again. */
const REPEAT_MS = 4000;
/** How long a toast takes to leave (its way-out animation in global.css). */
const OUT_MS = 220;
/** From here up the toasts sit in the top right corner (Tailwind's `md`). */
const WIDE = '(min-width: 768px)';

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const recent = useRef(new Map<string, number>());
  const layer = useRef<HTMLDivElement>(null);

  // A toast first plays its way out, then leaves the list.
  const drop = useCallback((id: number) => {
    setToasts((x) => x.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((x) => x.filter((t) => t.id !== id)), OUT_MS);
  }, []);
  const push = useCallback<Push>(
    (text, tone = 'ok', opts = {}) => {
      const key = `${tone}:${text}`;
      const now = Date.now();
      const last = recent.current.get(key);
      if (!text || (last !== undefined && now - last < REPEAT_MS)) return;
      recent.current.set(key, now);
      const id = now + Math.random();
      setToasts((x) => queued(x, { id, text, tone, silent: !!opts.silent, leaving: false }));
      setTimeout(() => drop(id), LIFE[tone]);
    },
    [drop],
  );

  const clearErrors = useCallback(() => setToasts((x) => x.filter((t) => t.tone !== 'error')), []);

  // The layer opens with the first toast and closes after the last. A dialog opened after it would
  // cover it, so with a dialog open a new toast shows the layer again, on top. (Showing it again
  // restarts the toasts' entrance, so it is not done otherwise.)
  const newest = toasts.at(-1)?.id;
  const empty = toasts.length === 0;
  useEffect(() => {
    const el = layer.current as
      (HTMLDivElement & { showPopover?: () => void; hidePopover?: () => void }) | null;
    if (!el?.showPopover) return;
    try {
      const open = el.matches(':popover-open');
      if (empty) {
        if (open) el.hidePopover?.();
        return;
      }
      if (open && document.querySelector('dialog[open]')) el.hidePopover?.();
      if (!el.matches(':popover-open')) el.showPopover();
    } catch {
      /* an older browser: the fixed layer below still shows them */
    }
  }, [newest, empty]);

  return (
    <Ctx.Provider value={push}>
      <ClearCtx.Provider value={clearErrors}>{children}</ClearCtx.Provider>
      <div
        ref={layer}
        // A manual popover lives in the top layer, above modal dialogs; without the API it is a
        // fixed layer like any other.
        {...{ popover: 'manual' }}
        aria-live="polite"
        data-testid="toasts"
        className="toast-layer pointer-events-none fixed top-0 right-0 bottom-auto left-0 z-[60] m-0 flex h-auto w-full max-w-none flex-col items-center gap-2 overflow-visible border-0 bg-transparent p-0 px-3 pt-[calc(env(safe-area-inset-top,0px)+10px)] md:left-auto md:w-[440px] md:items-stretch md:px-6 md:pt-6"
      >
        {[...toasts].reverse().map((t) => (
          <ToastCard key={t.id} toast={t} onDrop={() => drop(t.id)} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

/** One toast: a tap or a swipe (up on a phone, right from a tablet up) sends it away. */
function ToastCard({ toast: t, onDrop }: { toast: Toast; onDrop: () => void }) {
  const from = useRef<{ x: number; y: number; wide: boolean } | null>(null);
  const [shift, setShift] = useState(0);
  const [wide, setWide] = useState(false);

  const down = (e: PointerEvent<HTMLDivElement>) => {
    const w = matchMedia(WIDE).matches;
    from.current = { x: e.clientX, y: e.clientY, wide: w };
    setWide(w);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* not capturable (a synthetic event): the move still arrives while over the toast */
    }
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const f = from.current;
    if (!f) return;
    setShift(swipeShift(f, { x: e.clientX, y: e.clientY }, f.wide));
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    const f = from.current;
    from.current = null;
    if (!f) return;
    if (swipeEnd(f, { x: e.clientX, y: e.clientY }, f.wide) === 'away') onDrop();
    else setShift(0);
  };
  const cancel = () => {
    from.current = null;
    setShift(0);
  };

  return (
    <div
      className={`toast pointer-events-auto flex w-full max-w-[480px] cursor-pointer touch-none items-start gap-3 rounded-[18px] px-4 py-3 text-[0.9375rem] leading-snug shadow-[0_12px_32px_rgb(8_18_15/0.3)] select-none md:max-w-none ${LOOK[t.tone]}`}
      data-leaving={t.leaving || undefined}
      style={
        shift
          ? {
              transform: wide ? `translateX(${shift}px)` : `translateY(${shift}px)`,
              opacity: Math.max(0.35, 1 - Math.abs(shift) / 160),
              transition: 'none',
            }
          : undefined
      }
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={cancel}
      // An error a screen already announces (its Notice) is not read twice.
      {...(t.silent ? { 'aria-hidden': true } : { role: t.tone === 'error' ? 'alert' : 'status' })}
    >
      <span className="mt-px grid size-7 shrink-0 place-items-center rounded-full bg-current/15">
        <Icon name={ICON[t.tone]} size={16} strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1 self-center">{t.text}</span>
    </div>
  );
}

export const useToast = () => useContext(Ctx);
/** A toast once, when `when` turns true (a state a screen opens in: the session ended), instead
    of a line on the screen. */
export function useToastWhen(when: boolean, text: string, tone: ToastTone = 'info') {
  const push = useContext(Ctx);
  useEffect(() => {
    if (when) push(text, tone);
  }, [when, text, tone, push]);
}

/** Takes the error toasts off the screen (they belong to a screen that is gone). */
export const useClearErrors = () => useContext(ClearCtx);
