/* The rules behind the toasts (src/components/ui/Toast.tsx), apart from React so they can be
   tested: which toasts stay on screen when one more comes, and how a toast follows a swipe. */

/** At most this many toasts on screen; the oldest goes first. */
export const MAX_TOASTS = 3;
/** How far a toast is swiped before letting go sends it away. */
export const SWIPE_PX = 36;
/** A press that moves less than this is a tap. */
export const TAP_PX = 6;

/** The toasts after one more comes: the same message (same tone and words) is not shown twice,
    the newest goes last and only the newest `MAX_TOASTS` stay. */
export function queued<T extends { tone: string; text: string }>(list: T[], next: T): T[] {
  const same = (t: T) => t.tone === next.tone && t.text === next.text;
  return [...list.filter((t) => !same(t)).slice(-(MAX_TOASTS - 1)), next];
}

export type Point = { x: number; y: number };

/** How far the toast follows the pointer: only toward its way out, up on a phone and to the right
    from a tablet up (`wide`); the other way it stays put. */
export function swipeShift(from: Point, to: Point, wide: boolean): number {
  return wide ? Math.max(0, to.x - from.x) : Math.min(0, to.y - from.y);
}

/** On letting go: a tap or a swipe far enough sends the toast away; anything else puts it back. */
export function swipeEnd(from: Point, to: Point, wide: boolean): 'away' | 'back' {
  if (Math.hypot(to.x - from.x, to.y - from.y) < TAP_PX) return 'away';
  return Math.abs(swipeShift(from, to, wide)) >= SWIPE_PX ? 'away' : 'back';
}
