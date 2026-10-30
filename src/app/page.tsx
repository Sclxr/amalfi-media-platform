import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium text-primary">Amalfi Media</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Orlando and Central Florida</h1>
      <p className="mt-4 max-w-xl text-muted-foreground">
        Staff and clients sign in here. The public site at amalfimedia.xyz stays separate.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link href="/admin/login" className="rounded-md border border-border bg-card p-6 hover:border-primary">
          <span className="text-sm text-muted-foreground">Staff</span>
          <span className="mt-2 block text-lg font-semibold">Admin dashboard</span>
        </Link>
        <Link href="/portal/login" className="rounded-md border border-border bg-card p-6 hover:border-primary">
          <span className="text-sm text-muted-foreground">Realtors</span>
          <span className="mt-2 block text-lg font-semibold">Client portal</span>
        </Link>
      </div>
      <p className="mt-10 text-sm text-muted-foreground">321-246-6018 · eathen@amalfimedia.xyz</p>
    </main>
  );
}
