import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { REPO_URL, SITE_URL } from "@/lib/results";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" });
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "plugweight", template: "%s | plugweight" },
  description: "See what each Claude Code plugin really adds to every session. Measured, not estimated.",
  openGraph: { title: "plugweight", description: "What the most-installed Claude Code plugins really add to every session. Measured, not estimated.", type: "website" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${geist.variable} ${geistMono.variable}`}>
      <body className="min-h-[100dvh] antialiased">
        <header className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 md:px-8">
          <Link href="/" className="font-display text-xl font-bold tracking-tight">plugweight</Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/method" className="text-ink-2 hover:text-ink">Method</Link>
            <a href={REPO_URL} className="text-ink-2 hover:text-ink">GitHub</a>
          </nav>
        </header>
        {children}
        <footer className="mx-auto mt-24 max-w-[1200px] border-t border-rule px-4 py-8 text-sm leading-relaxed text-ink-2 md:px-8">
          <p className="max-w-[65ch]">
            An independent open source project by{" "}
            <a className="underline underline-offset-2 hover:text-ink" href="https://github.com/BSSE23047">Nauraiz Haider</a>.
            Not made by or affiliated with Anthropic. A listing is not a safety review, and a heavier plugin may be worth it.
          </p>
        </footer>
      </body>
    </html>
  );
}
