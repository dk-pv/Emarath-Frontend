/**
 * The overlays open right now, innermost last, and which of them an Escape press closes: the
 * innermost, and only one overlay per press — so a select or date picker open inside a drawer,
 * modal or popover closes on its own instead of taking its container down with it.
 *
 * A press is claimed, not only compared with the stack. Every overlay listens on the document, and
 * the browser runs React's pending work between two listeners of the same press: the closing
 * dropdown leaves the stack before the next listener runs. An outer overlay whose listener comes
 * later — re-registered because it re-rendered while the dropdown was open, as a filter popover
 * does when a choice applies at once — would then find itself innermost and close as well.
 *
 * Import-free, so its self-check (`overlay-stack.check.ts`) compiles with plain tsc.
 */
const open: object[] = [];
const claimed = new WeakSet<Event>();

/** Registers an overlay that just opened, as the innermost. Its token closes it again. */
export function openOverlay(): object {
  const token = {};
  open.push(token);
  return token;
}

/** Removes an overlay that closed — that one only, wherever it sits. */
export function closeOverlay(token: object): void {
  const index = open.indexOf(token);
  if (index !== -1) open.splice(index, 1);
}

/** Whether `token`'s overlay answers this Escape press: it is innermost and no overlay has yet. */
export function claimEscape(event: Event, token: object | null): boolean {
  if (claimed.has(event) || open[open.length - 1] !== token) return false;
  claimed.add(event);
  return true;
}
