import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="mt-2 text-3xl font-semibold">That page is not available</h1>
      <p className="mt-3 text-muted-foreground">The address may be wrong, or this account cannot open it.</p>
      <Link className="mt-6 text-sm font-medium text-primary" href="/">
        Back to Amalfi
      </Link>
    </main>
  );
}
