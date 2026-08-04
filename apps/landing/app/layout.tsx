import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { getSeptemberCampaignState, septemberCampaign } from "./campaign";
import { AppLink } from "./components/AppLink";
import { DesktopNavigation } from "./components/DesktopNavigation";
import { MobileNavigation } from "./components/MobileNavigation";
import { PublicSiteAnalytics } from "./components/PublicSiteAnalytics";
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
  const campaignState = getSeptemberCampaignState();
  const description =
    campaignState.phase === "ended"
      ? `Review the September 2026 GoGymGo beta and request updates about future availability on ${septemberCampaign.regionName}.`
      : `Join the free September 2026 GoGymGo beta for eligible gym-goers age ${septemberCampaign.minimumAge}+ on ${septemberCampaign.regionName}.`;
  const socialDescription =
    campaignState.phase === "ended"
      ? "The September 2026 beta has ended. Review the pilot and request future regional updates."
      : `Free September beta. ${septemberCampaign.minimumAge}+. ${septemberCampaign.minimumSessionMinutes}+ minute verified partner-gym workouts. One ${septemberCampaign.reward} reward.`;

  return {
    metadataBase,
    title: {
      default: "GoGymGo — Make consistency count",
      template: "%s | GoGymGo",
    },
    description,
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
      description: socialDescription,
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
      description: socialDescription,
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
  const campaignState = getSeptemberCampaignState();
  const memberRegistrationAvailable =
    campaignState.primaryAction === "memberApp";

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
            {memberRegistrationAvailable ? (
              <AppLink
                analyticsEvent="member_app_click"
                className="header-cta button-primary"
                href={siteLinks.memberApp}
              >
                <span className="header-cta-long">
                  {campaignState.primaryLabel}
                </span>
                <span className="header-cta-short">
                  {campaignState.phase === "active" ? "CHECK APP" : "JOIN BETA"}
                </span>
              </AppLink>
            ) : (
              <Link
                className="header-cta button-primary"
                data-analytics-event="regional_updates_click"
                href={siteLinks.regionalUpdates}
              >
                <span className="header-cta-long">GET REGIONAL UPDATES</span>
                <span className="header-cta-short">UPDATES</span>
                <b aria-hidden="true">→</b>
              </Link>
            )}
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
              {memberRegistrationAvailable ? (
                <AppLink
                  analyticsEvent="member_app_click"
                  href={siteLinks.memberApp}
                >
                  September beta registration
                </AppLink>
              ) : (
                <Link href={siteLinks.gymGoers}>September beta details</Link>
              )}
              <Link
                data-analytics-event="regional_updates_click"
                href={siteLinks.regionalUpdates}
              >
                Regional launch updates
              </Link>
              <Link href="/#how-it-works">How GoGymGo works</Link>
            </div>
            <div>
              <p className="footer-label">EXPLORE</p>
              <AppLink analyticsEvent="demo_click" href={siteLinks.demo}>
                App demo
              </AppLink>
              <Link
                data-analytics-event="brand_partnership_click"
                href={siteLinks.brands}
              >
                Fitness brand partnerships
              </Link>
              <Link href={siteLinks.faq}>Frequently asked questions</Link>
              <Link href={siteLinks.contact}>Contact</Link>
            </div>
            <div>
              <p className="footer-label">LEGAL & ACCESS</p>
              <AppLink href={siteLinks.privacy}>Privacy Policy</AppLink>
              <AppLink href={siteLinks.terms}>Terms of Service</AppLink>
              <AppLink href={siteLinks.officialRules}>
                Official Contest Rules
              </AppLink>
              <Link href={siteLinks.accessibility}>Accessibility</Link>
            </div>
          </div>
          <div className="shell footer-bottom">
            <span>© {new Date().getFullYear()} GoGymGo</span>
            <AppLink href={siteLinks.officialRules}>
              NO PURCHASE REQUIRED // ELIGIBILITY AND REGIONAL RULES APPLY
            </AppLink>
          </div>
        </footer>
        <PublicSiteAnalytics />
      </body>
    </html>
  );
}
