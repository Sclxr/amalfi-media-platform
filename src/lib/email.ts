export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const value = email.trim().toLowerCase();
  return value.length > 0 ? value : null;
}
