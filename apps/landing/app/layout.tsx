import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { DesktopNavigation } from "./components/DesktopNavigation";
import { MobileNavigation } from "./components/MobileNavigation";
import { septemberCampaign } from "./campaign";
import { siteLinks } from "./site-links";
import "./globals.css";
import "./experience.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
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
      `Join the free September 2026 GoGymGo beta for eligible gym-goers age ${septemberCampaign.minimumAge}+ on ${septemberCampaign.regionName}.`,
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
        `Free September beta. ${septemberCampaign.minimumAge}+. ${septemberCampaign.minimumSessionMinutes}+ minute verified partner-gym workouts. One ${septemberCampaign.reward} reward.`,
      type: "website",
      siteName: "GoGymGo",
      images: socialImage
        ? [
            {
              url: socialImage,
              width: 1200,
              height: 630,
              alt: "GoGymGo September 2026 beta — Make consistency count.",
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: "GoGymGo — Make consistency count",
      description:
        `Free September beta. ${septemberCampaign.minimumAge}+. ${septemberCampaign.minimumSessionMinutes}+ minute verified partner-gym workouts. One ${septemberCampaign.reward} reward.`,
      images: socialImage ? [socialImage] : undefined,
    },
    alternates: {
      canonical: "/",
    },
    icons: {
      icon: "/mark.svg",
    },
    manifest: "/manifest.webmanifest",
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
            <DesktopNavigation />
            <MobileNavigation />
            <Link
              className="header-cta button-primary"
              href={siteLinks.memberApp}
              aria-label="Join the September 2026 beta in the GoGymGo app"
            >
              <span className="header-cta-long">JOIN SEPTEMBER BETA</span>
              <span className="header-cta-short">JOIN BETA</span>
              <b aria-hidden="true">→</b>
            </Link>
          </div>
        </header>
        <div id="main-content" tabIndex={-1}>
          {children}
        </div>
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
              <p className="footer-label">GYM GOERS</p>
              <Link href={siteLinks.memberApp}>September beta registration</Link>
              <Link href={siteLinks.regionalUpdates}>Regional launch updates</Link>
              <Link href="/#how-it-works">How GoGymGo works</Link>
            </div>
            <div>
              <p className="footer-label">EXPLORE</p>
              <Link
                aria-label="Open the GoGymGo app demo"
                href={siteLinks.demo}
              >
                App demo <span aria-hidden="true">↗</span>
              </Link>
              <Link href={siteLinks.brands}>Fitness brand partnerships</Link>
              <Link href={siteLinks.faq}>Frequently asked questions</Link>
              <Link href={siteLinks.contact}>Contact</Link>
            </div>
            <div>
              <p className="footer-label">LEGAL & ACCESS</p>
              <Link href={siteLinks.privacy}>Privacy Policy</Link>
              <Link href={siteLinks.terms}>Terms of Service</Link>
              <Link href={siteLinks.officialRules}>Official Contest Rules</Link>
              <Link href={siteLinks.accessibility}>Accessibility</Link>
            </div>
          </div>
          <div className="shell footer-bottom">
            <span>© {new Date().getFullYear()} GoGymGo</span>
            <Link href={siteLinks.officialRules}>
              NO PURCHASE REQUIRED // ELIGIBILITY AND REGIONAL RULES APPLY
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
