import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

/**
 * Workpex renders in a geometric sans with a single-storey 'a'. Poppins matches that
 * skeleton, and its 0.70 cap-height ratio reproduces the measured cap heights (12px
 * at 17px nav text, 19px at 27px page titles) — but the licensed face itself has not
 * been supplied. See "Assets Required" for FND-02.2.
 */
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
    <html lang="en" className={`${poppins.variable} h-full antialiased`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
