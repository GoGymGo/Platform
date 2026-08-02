import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import "./globals.css";
import "./experience.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host?.includes("localhost") ? "http" : "https");
  const metadataBase = host ? new URL(`${protocol}://${host}`) : undefined;
  const socialImage = metadataBase
    ? new URL("/og.png", metadataBase).toString()
    : undefined;

  return {
    metadataBase,
    title: {
      default: "GoGymGo — Make consistency count",
      template: "%s | GoGymGo",
    },
    description:
      "GoGymGo turns verified gym attendance into streaks, friend challenges, regional competition, and chances to win fitness brand rewards.",
    applicationName: "GoGymGo",
    keywords: [
      "gym motivation",
      "fitness challenges",
      "verified workouts",
      "gym rewards",
      "fitness competition",
    ],
    openGraph: {
      title: "GoGymGo — Make consistency count",
      description:
        "Verified workouts. Friend challenges. Regional competition. Fitness brand rewards.",
      type: "website",
      siteName: "GoGymGo",
      images: socialImage
        ? [
            {
              url: socialImage,
              width: 1731,
              height: 909,
              alt: "GoGymGo — Make consistency count.",
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: "GoGymGo — Make consistency count",
      description:
        "Verified workouts. Friend challenges. Regional competition. Fitness brand rewards.",
      images: socialImage ? [socialImage] : undefined,
    },
  };
}

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#080B0E",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <header className="site-header">
          <div className="shell header-inner">
            <Link aria-label="GoGymGo home" className="wordmark" href="/">
              <span className="wordmark-cyan">GO</span>
              <span className="wordmark-pink">GYM</span>
              <span className="wordmark-cyan">GO</span>
            </Link>
            <nav aria-label="Primary navigation">
              <Link href="/#how-it-works">HOW IT WORKS</Link>
              <Link href="https://app.gogymgo.com/demo">DEMO</Link>
              <Link href="/gym-goers">GYM GOERS</Link>
              <Link href="/brands">FITNESS BRANDS</Link>
            </nav>
            <Link className="header-cta" href="https://app.gogymgo.com/join">
              JOIN BETA <span aria-hidden="true">→</span>
            </Link>
          </div>
        </header>
        <div id="main-content">{children}</div>
        <footer className="site-footer">
          <div className="shell footer-grid">
            <div>
              <Link aria-label="GoGymGo home" className="wordmark" href="/">
                <span className="wordmark-cyan">GO</span>
                <span className="wordmark-pink">GYM</span>
                <span className="wordmark-cyan">GO</span>
              </Link>
              <p>Make consistency count.</p>
            </div>
            <div>
              <p className="footer-label">JOIN EARLY</p>
              <Link href="/gym-goers">Gym-goer pre-registration</Link>
              <Link href="/brands">Fitness brand partnerships</Link>
            </div>
            <div>
              <p className="footer-label">THE PRODUCT</p>
              <Link href="/#how-it-works">How GoGymGo works</Link>
              <Link href="https://app.gogymgo.com/demo">Interactive app walkthrough</Link>
              <span>Launching region by region</span>
            </div>
          </div>
          <div className="shell footer-bottom">
            <span>© {new Date().getFullYear()} GoGymGo</span>
            <span>NO PURCHASE REQUIRED // REWARDS SUBJECT TO REGIONAL RULES</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
