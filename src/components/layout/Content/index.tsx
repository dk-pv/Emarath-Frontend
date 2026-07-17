/**
 * The scrolling content region.
 *
 * It is the only scroll container in the shell, so the sidebar and navbar stay put
 * without `position: fixed` — which also means the sidebar reserves its width and
 * can never overlap this area. Content begins immediately below the navbar's border.
 */
export function Content({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-0 min-w-0 flex-1 overflow-auto bg-canvas">
      {children}
    </main>
  );
}
