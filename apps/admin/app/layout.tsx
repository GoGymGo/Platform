import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const description =
  "Secure operations control for GoGymGo contests, rewards, regions and content.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const fallbackOrigin = process.env.SITE_URL ?? "http://localhost:3001";
  let origin = fallbackOrigin;

  if (host) {
    try {
      origin = new URL(`${protocol}://${host}`).origin;
    } catch {
      origin = fallbackOrigin;
    }
  }

  return {
    metadataBase: new URL(origin),
    title: {
      default: "GoGymGo Admin",
      template: "%s | GoGymGo Admin",
    },
    description,
    icons: {
      icon: "/icon.png",
      shortcut: "/icon.png",
    },
    openGraph: {
      type: "website",
      title: "GoGymGo Admin",
      description,
      images: [
        {
          url: new URL("/og.png", origin).toString(),
          alt: "GoGymGo Admin — Secure contest control",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "GoGymGo Admin",
      description,
      images: [new URL("/og.png", origin).toString()],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
