/** Public origins shared by the media resolver, error reporting and the CSP. See public-origins.mjs. */
export function publicOrigins(): {
  api: string;
  media: string[];
  errorReporting: { dsn: string; origin: string } | null;
};
