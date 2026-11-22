import { describe, expect, it } from 'vitest';
import { MAX_TOASTS, queued, swipeEnd, swipeShift } from '@/components/ui/toast-model';

const toast = (text: string, tone = 'ok') => ({ text, tone });

describe('queued', () => {
  it('puts the newest last and keeps at most three', () => {
    let list: { text: string; tone: string }[] = [];
    for (const text of ['a', 'b', 'c', 'd']) list = queued(list, toast(text));
    expect(list.map((t) => t.text)).toEqual(['b', 'c', 'd']);
    expect(list).toHaveLength(MAX_TOASTS);
  });

  it('shows the same message once, moved to the newest place', () => {
    const list = queued([toast('saved'), toast('other')], toast('saved'));
    expect(list.map((t) => t.text)).toEqual(['other', 'saved']);
  });

  it('keeps the same words in another tone apart', () => {
    const list = queued([toast('done', 'ok')], toast('done', 'error'));
    expect(list.map((t) => t.tone)).toEqual(['ok', 'error']);
  });
});

describe('swipe', () => {
  const at = { x: 100, y: 100 };

  it('follows the pointer only toward the way out', () => {
    // A phone: up, never down.
    expect(swipeShift(at, { x: 100, y: 60 }, false)).toBe(-40);
    expect(swipeShift(at, { x: 100, y: 140 }, false)).toBe(0);
    // From a tablet up: right, never left.
    expect(swipeShift(at, { x: 150, y: 100 }, true)).toBe(50);
    expect(swipeShift(at, { x: 40, y: 100 }, true)).toBe(0);
  });

  it('a tap sends it away', () => {
    expect(swipeEnd(at, { x: 102, y: 103 }, false)).toBe('away');
    expect(swipeEnd(at, at, true)).toBe('away');
  });

  it('a swipe far enough sends it away; a short one or the other way puts it back', () => {
    expect(swipeEnd(at, { x: 100, y: 50 }, false)).toBe('away');
    expect(swipeEnd(at, { x: 100, y: 80 }, false)).toBe('back');
    expect(swipeEnd(at, { x: 100, y: 180 }, false)).toBe('back');
    expect(swipeEnd(at, { x: 160, y: 100 }, true)).toBe('away');
    expect(swipeEnd(at, { x: 20, y: 100 }, true)).toBe('back');
  });
});
