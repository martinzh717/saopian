import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";
import { getAppBasePath } from "@/lib/build-mode";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  if (!siteUrl) return [];
  const page = new URL(`${getAppBasePath() || ""}/`, siteUrl).href;
  return [{ url: page }];
}
