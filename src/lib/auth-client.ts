"use client";

import { createAuthClient } from "better-auth/react";
import { emailOTPClient, twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  basePath: "/portal/api/auth",
  plugins: [emailOTPClient(), twoFactorClient()],
});
