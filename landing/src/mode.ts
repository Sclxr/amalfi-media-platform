/** Preview builds show placeholder notes. Production builds omit them. */
export const isProduction = import.meta.env.PUBLIC_SITE_MODE === "production";
