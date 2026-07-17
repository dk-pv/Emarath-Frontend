import { redirect } from "next/navigation";

/**
 * Dashboard is the default landing area (FND-02.2 AC5). This replaces the FND-01.1
 * diagnostic page, which described itself as temporary and named the app shell as
 * its successor. Once Authentication lands, the target becomes session-dependent.
 */
export default function Home() {
  redirect("/dashboard");
}
