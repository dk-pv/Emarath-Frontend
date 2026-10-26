import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/auth-context";

/**
 * Workpex's own face, identified from its stylesheet rather than inferred (2026-09-08):
 * `app.workpex.com/build/assets/app-6jCTq0Gd.css` sets
 * `body { font-family: Plus Jakarta Sans, sans-serif !important }` and imports
 * `fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700`.
 * Those are the four weights loaded here. (Its `--font-sans` names Instrument Sans —
 * the Laravel starter default, which that `!important` body rule overrides.)
 *
 * This replaces Poppins, which was a guess at "a geometric sans with a single-storey a"
 * and ran materially wider at the same cap height (ADR-0075, ADR-0077).
 */
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Emarath",
  description: "Emarath ERP / CRM platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
      <body className="font-sans">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
