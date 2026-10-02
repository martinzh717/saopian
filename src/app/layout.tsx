import type { Metadata, Viewport } from "next";
import { AnalyticsLoader } from "@/components/analytics/AnalyticsLoader";
import { BRAND } from "@/lib/brand";
import { getAppBasePath, isWebPublicBuild } from "@/lib/build-mode";
import { getSiteUrl } from "@/lib/site";
import { Instrument_Sans, JetBrains_Mono, Syne } from "next/font/google";
import "./globals.css";

const display = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const body = Instrument_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const siteUrl = getSiteUrl();
const basePath = getAppBasePath();
const publicPageUrl = siteUrl
  ? new URL(`${basePath || ""}/`, siteUrl).href
  : undefined;

export const metadata: Metadata = {
  metadataBase: siteUrl,
  applicationName: BRAND.name,
  title: { default: BRAND.title, template: "%s · 扫片" },
  description: BRAND.description,
  category: "video",
  keywords: ["扫片", "本地视频", "视频预览", "划览", "素材筛选", "hover scrubbing"],
  alternates: siteUrl ? { canonical: "/" } : undefined,
  robots: { index: Boolean(siteUrl), follow: Boolean(siteUrl) },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: BRAND.name,
    title: BRAND.title,
    description: BRAND.description,
    ...(publicPageUrl ? {
      url: publicPageUrl,
      images: [{ url: "/brand/share.png", width: 1200, height: 630, alt: BRAND.title }],
    } : {}),
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND.title,
    description: BRAND.description,
    ...(siteUrl ? { images: [new URL(`${basePath}/brand/share.png`, siteUrl).href] } : {}),
  },
};

export const viewport: Viewport = {
  themeColor: BRAND.themeColor,
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {isWebPublicBuild() ? <AnalyticsLoader /> : null}
        {children}
      </body>
    </html>
  );
}
