import Link from "next/link";
import { cn } from "@/lib/utils";

export function LegalLinks({ className, tone = "muted" }: { className?: string; tone?: "muted" | "on-dark" }) {
  const link = tone === "on-dark" ? "text-[#d4bc8c] hover:text-white" : "text-foreground underline-offset-4 hover:underline";
  return (
    <nav aria-label="Legal" className={cn("flex flex-wrap items-center gap-x-4 gap-y-1", className)}>
      <Link className={cn("inline-flex min-h-12 items-center", link)} href="/terms">
        Terms
      </Link>
      <Link className={cn("inline-flex min-h-12 items-center", link)} href="/privacy">
        Privacy
      </Link>
    </nav>
  );
}
