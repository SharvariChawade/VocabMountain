import type { Metadata, Viewport } from "next";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vocab Mountain",
  description: "Build a stronger vocabulary, one word at a time.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Light only for now. pouf.css keys dark off [data-theme='dark'], so pinning
// this here is enough — no theme script, nothing to flash.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="light" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
