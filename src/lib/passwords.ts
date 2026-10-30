const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "123456",
  "123456789",
  "12345678",
  "qwerty",
  "qwerty123",
  "111111",
  "1234567890",
  "123123",
  "abc123",
  "password1!",
  "iloveyou",
  "admin",
  "admin123",
  "welcome",
  "welcome1",
  "letmein",
  "monkey",
  "dragon",
  "master",
  "login",
  "princess",
  "solo",
  "passw0rd",
  "starwars",
  "freedom",
  "whatever",
  "trustno1",
  "changeme",
  "amalfi",
  "amalfimedia",
  "orlando",
]);

export function assertPasswordAcceptable(password: string): string | null {
  if (password.length < 10) return "Use at least 10 characters.";
  if (password.length > 128) return "Use 128 characters or fewer.";
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return "That password appears in a common breached-password list. Choose a different one.";
  }
  return null;
}
