import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { campaignAction } from "@/app/(admin)/admin/(app)/marketing/actions";
import { StatusBadge } from "@/components/data/status-badge";
import { ArchivedBanner } from "@/components/removal/archive-view";
import { RecordMenu } from "@/components/removal/record-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CAN_SPAM_ADDRESS_LINES, listUnsubscribeHeaders } from "@/lib/canspam";
import { can } from "@/lib/permissions";
import { campaignRemoval } from "@/lib/removal";
import { getActor } from "@/server/auth/guards";
import { campaignPreviewHtml, getCampaign, recipientsForCampaign } from "@/server/services/campaigns";

export const metadata = { title: "Campaign" };

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  const { id } = await params;
  const query = await searchParams;
  const campaign = await getCampaign(actor, id);
  if (!campaign) notFound();
  const [html, recipients] = await Promise.all([campaignPreviewHtml(actor, id), recipientsForCampaign(actor, id)]);
  const action = campaignAction.bind(null, campaign.id);
  const headers = listUnsubscribeHeaders("https://app.amalfimedia.xyz/api/unsubscribe?token=preview");
  const sentMessages = campaign.messages.filter((message) => message.sentAt).length;
  return (
    <div className="space-y-6">
      {campaign.archivedAt ? <ArchivedBanner>This campaign is archived. Restore it to put it back on the active list.</ArchivedBanner> : null}
      <RecordMenu
        kind="campaign"
        id={campaign.id}
        name={campaign.name}
        archived={Boolean(campaign.archivedAt)}
        canArchive={can(actor, "marketing.draft")}
        canPermanent={can(actor, "records.delete")}
        deletable={campaignRemoval({ status: campaign.status, sentMessages }).canDelete}
        returnTo={`/admin/marketing/campaigns/${campaign.id}`}
      />
      <div>
        <Link className="text-sm text-primary" href="/admin/marketing">
          Marketing
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{campaign.name}</h1>
          <StatusBadge status={campaign.status} />
        </div>
        <p className="mt-2 text-muted-foreground">{campaign.subject}</p>
      </div>
      {query.notice ? <p className="rounded-md border border-border px-4 py-3 text-sm">{query.notice}</p> : null}
      <div className="flex flex-wrap gap-2">
        {campaign.status === "DRAFT" ? (
          <form action={action}>
            <input type="hidden" name="action" value="submit" />
            <Button type="submit">Submit for approval</Button>
          </form>
        ) : null}
        {campaign.status === "PENDING_APPROVAL" && can(actor, "marketing.send") ? (
          <form action={action}>
            <input type="hidden" name="action" value="approve" />
            <Button type="submit">Approve</Button>
          </form>
        ) : null}
        {campaign.status === "APPROVED" && can(actor, "marketing.send") ? (
          <form action={action}>
            <input type="hidden" name="action" value="send" />
            <Button type="submit" variant="secondary">
              Send
            </Button>
          </form>
        ) : null}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>CAN-SPAM</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {CAN_SPAM_ADDRESS_LINES.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <p>{recipients.length} recipients after the segment and suppression list.</p>
          <p className="text-muted-foreground">
            {headers["List-Unsubscribe"]} · {headers["List-Unsubscribe-Post"]}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose text-sm" dangerouslySetInnerHTML={{ __html: html ?? "" }} />
        </CardContent>
      </Card>
    </div>
  );
}
