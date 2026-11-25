/** Preview builds are noindex. Production builds can be indexed. */
export const isProduction = import.meta.env.PUBLIC_SITE_MODE === "production";
