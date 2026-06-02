type JsonLdValue = string | number | boolean | null | JsonLdObject | JsonLdValue[];

interface JsonLdObject {
  [key: string]: JsonLdValue | undefined;
}

interface SeoHeadOptions {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
  includeCanonical?: boolean;
  structuredData?: JsonLdObject | JsonLdObject[];
}

export const siteName = "Better Auth Paystack";
export const defaultSeoTitle = "Better Auth Paystack TanStack Start Demo";
export const defaultSeoDescription =
  "Demo billing workbench for Better Auth Paystack on TanStack Start, with Paystack subscriptions, one-time payments, organization billing, and secure webhooks.";

const fallbackOrigin = "http://localhost:3000";
const defaultImagePath = "/logo512.png";
const githubUrl = "https://github.com/alexasomba/better-auth-paystack";
const npmUrl = "https://www.npmjs.com/package/@alexasomba/better-auth-paystack";

export function getSeoOrigin() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return normalizeOrigin(
    process.env.VITE_BETTER_AUTH_URL ?? process.env.BETTER_AUTH_URL ?? process.env.URL,
  );
}

export function getSeoUrl(path = "/") {
  return new URL(path, `${getSeoOrigin()}/`).toString();
}

export function createSeoHead(options: SeoHeadOptions = {}) {
  const title = options.title === undefined ? defaultSeoTitle : `${options.title} | ${siteName}`;
  const description = options.description ?? defaultSeoDescription;
  const canonicalUrl = getSeoUrl(options.path ?? "/");
  const imageUrl = getSeoUrl(options.image ?? defaultImagePath);
  const robots = options.noIndex === true ? "noindex, nofollow" : "index, follow";

  return {
    meta: [
      { title },
      { name: "description", content: description },
      { name: "application-name", content: siteName },
      { name: "robots", content: robots },
      { name: "theme-color", content: "#0f172a" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: siteName },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: canonicalUrl },
      { property: "og:image", content: imageUrl },
      { property: "og:image:alt", content: defaultSeoTitle },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: imageUrl },
    ],
    links: options.includeCanonical === false ? [] : [{ rel: "canonical", href: canonicalUrl }],
    scripts:
      options.structuredData === undefined
        ? []
        : [
            {
              type: "application/ld+json",
              children: JSON.stringify(options.structuredData),
            },
          ],
  };
}

export function createHomeStructuredData() {
  const url = getSeoUrl("/");
  const image = getSeoUrl(defaultImagePath);

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: defaultSeoTitle,
      url,
      description: defaultSeoDescription,
      inLanguage: "en",
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: siteName,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      url,
      image,
      description: defaultSeoDescription,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      sameAs: [githubUrl, npmUrl],
    },
  ];
}

function normalizeOrigin(value: string | undefined) {
  if (value === undefined || value === "") {
    return fallbackOrigin;
  }

  try {
    return new URL(value).origin;
  } catch {
    return fallbackOrigin;
  }
}
