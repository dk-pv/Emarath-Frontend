import { RedirectIfAuthenticated } from "@/components/auth/redirect-if-authenticated";

/**
 * Layout for the authentication routes (AUTH-01.6). A sibling of the `(app)` group, so
 * these pages render outside the sidebar/navbar shell — login owns the full viewport.
 * Providers come from the root layout (AuthProvider); the gate keeps signed-in users out.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh">
      <RedirectIfAuthenticated>{children}</RedirectIfAuthenticated>
    </main>
  );
}
