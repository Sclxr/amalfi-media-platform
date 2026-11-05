import type { Metadata } from "next";
import { LegalDocument, LegalSection } from "@/components/legal/legal-document";
import { pageShare } from "@/lib/share";

export const metadata: Metadata = pageShare(
  "Privacy",
  "How Amalfi Media handles account, listing, and payment details for Orlando and Central Florida clients.",
);

export default function PrivacyPage() {
  return (
    <LegalDocument title="Privacy">
      <LegalSection heading="What we keep">
        <p>
          We keep the details needed to run a shoot and a gallery: your name, email, phone if you gave one, the listing address, order and invoice amounts, and a record of downloads. Sign-in codes are stored only long enough to check them, and they are stored as a hash.
        </p>
      </LegalSection>
      <LegalSection heading="Payments">
        <p>
          Card numbers are entered on Stripe. Amalfi Media receives the result of the payment, the amount, and the fee. We do not keep the full card number. If you pay by Zelle, we store that you chose Zelle, the listing price, and any short note an admin records when the payment is confirmed. We do not receive your bank login.
        </p>
      </LegalSection>
      <LegalSection heading="How it is used">
        <p>
          We use this information to schedule work, show you the right gallery, send a sign-in code, send an invite, send a receipt, and unlock downloads after payment. Transactional email is for those messages. We do not sell personal information.
        </p>
      </LegalSection>
      <LegalSection heading="Who else sees it">
        <p>
          Stripe processes card payments. The email service delivers codes, invites, and receipts. Staff at Amalfi Media can see the account and the listing so they can deliver the work. A hosting provider stores the app and the photo files.
        </p>
      </LegalSection>
      <LegalSection heading="This browser">
        <p>
          A session cookie keeps you signed in. The color theme is saved in this browser. The app pages send a noindex header so search engines are asked not to list them.
        </p>
      </LegalSection>
      <LegalSection heading="Your requests">
        <p>
          Email eathen@amalfimedia.xyz to correct your name or email, or to ask what we have on file. We operate in Orlando, Florida. Some requests may be limited when we still need a record for an invoice, a payment, or a legal duty.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
