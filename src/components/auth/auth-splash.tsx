import { Loading } from "@/components/ui/Loading";

/**
 * Full-viewport session-check splash (AUTH-01.6 Phase 3). The auth gates render this while
 * the initial `/auth/refresh` resolves, so neither the app shell nor the login form flashes
 * before the session state is known.
 */
export function AuthSplash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Loading />
    </div>
  );
}
