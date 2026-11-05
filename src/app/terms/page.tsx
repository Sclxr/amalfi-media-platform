import type { Metadata } from "next";
import { LegalDocument, LegalSection } from "@/components/legal/legal-document";
import { pageShare } from "@/lib/share";

export const metadata: Metadata = pageShare(
  "Terms",
  "Terms for Amalfi Media accounts, galleries, payments, and photo downloads in Orlando and Central Florida.",
);

export default function TermsPage() {
  return (
    <LegalDocument title="Terms">
      <LegalSection heading="Who this is">
        <p>
          Amalfi Media photographs homes and listings in Orlando and Central Florida. These terms cover the client portal: accounts, galleries, payments, and downloads.
        </p>
      </LegalSection>
      <LegalSection heading="Accounts">
        <p>
          Sign in with the email on your account. A sign-in code expires in 10 minutes. An invite link attaches the gallery to the client already on the listing. It does not open a second client for the same email. Keep the code and the invite to yourself.
        </p>
      </LegalSection>
      <LegalSection heading="Galleries">
        <p>
          Previews in the portal carry a watermark. They are for review. The files without the watermark are the downloads, and they stay locked until the invoice is paid.
        </p>
      </LegalSection>
      <LegalSection heading="Payments">
        <p>
          A card payment runs through Stripe. The card total is the listing price plus a separate card processing fee, so the listing price remains after Stripe’s fee. Amalfi Media does not store the full card number.
        </p>
        <p>
          Zelle is offered at the listing price, with no card fee. After you choose Zelle, downloads stay locked until Amalfi confirms the payment. Sending the Zelle transfer is between you and your bank. The memo should include the listing address and the order number.
        </p>
      </LegalSection>
      <LegalSection heading="Downloads">
        <p>
          A paid download is a license to use the photos to market that listing. It is not a sale of the copyright, and it is not a license to resell the photos as stock or to use them for a different property.
        </p>
      </LegalSection>
      <LegalSection heading="Photos and marks">
        <p>
          Amalfi Media keeps the copyright in the photographs and in the Amalfi name and mark, unless a written agreement says otherwise. Do not remove the watermark from a preview and present it as the finished file.
        </p>
      </LegalSection>
      <LegalSection heading="Liability">
        <p>
          Photos are for marketing a property. They are not an inspection, an appraisal, or a survey. To the extent Florida law allows, Amalfi Media is not liable for lost deals, lost profits, or indirect damages. If a photo file is lost or defective, the remedy is a replacement file or a refund of the amount you paid for that order.
        </p>
      </LegalSection>
      <LegalSection heading="Florida">
        <p>
          These terms are governed by the laws of the State of Florida. Disputes are handled in the state or federal courts located in Orange County, Florida, unless a law requires another venue.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
