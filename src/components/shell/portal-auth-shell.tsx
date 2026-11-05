import { LegalLinks } from "@/components/legal/legal-links";
import { ThemeToggle } from "@/components/shell/theme-toggle";

export function PortalAuthShell({ children, testId }: { children: React.ReactNode; testId?: string }) {
  return (
    <main className="min-h-screen bg-background" data-testid={testId}>
      <header className="flex h-16 items-center justify-between border-b border-white/10 bg-[#111111] px-4 text-[#f7f5f0]">
        <p className="text-xs font-semibold tracking-[0.16em]">
          AMALFI <span className="text-[#d4bc8c]">MEDIA</span>
        </p>
        <ThemeToggle className="text-[#f7f5f0] hover:bg-white/10" />
      </header>
      <div className="mx-auto w-full max-w-md px-4 py-10">
        {children}
        <LegalLinks className="mt-6 justify-center" />
      </div>
    </main>
  );
}
