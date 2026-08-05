import type { MetadataRoute } from "next";

// This app is internal club-management software — never meant to be
// crawled or listed by any search engine.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
