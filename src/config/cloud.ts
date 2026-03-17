export const isCloudEnabled =
  import.meta.env.VITE_CLOUD_ENABLED === "true";

function normalizeApiUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let url = raw.trim().replace(/\/+$/, "");
  if (url && !/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url || undefined;
}

export const apiUrl = normalizeApiUrl(
  import.meta.env.VITE_API_URL as string | undefined,
);

export const stripePublishableKey = import.meta.env
  .VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

export const stripeMonthlyPriceId = import.meta.env
  .VITE_STRIPE_MONTHLY_PRICE_ID as string | undefined;

export const stripeAnnualPriceId = import.meta.env
  .VITE_STRIPE_ANNUAL_PRICE_ID as string | undefined;

export const monthlyPrice = "$4.99/mo";
export const annualPrice = "$49.99/yr";
