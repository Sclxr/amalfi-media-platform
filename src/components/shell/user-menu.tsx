"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import type { ShellUser } from "@/lib/actor";

export function UserMenu({ user }: { user: ShellUser }) {
  const router = useRouter();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="ml-1 flex h-10 max-w-48 items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-accent">
        <span className="grid size-8 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {user.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block truncate font-medium">{user.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{user.role.toLowerCase()}</span>
        </span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="z-50 min-w-52 rounded-md border border-border bg-card p-1 shadow-[var(--shadow)]" align="end" sideOffset={8}>
          <DropdownMenu.Item asChild>
            <Link className="block rounded px-3 py-2 text-sm outline-none hover:bg-accent" href="/admin/account">
              Account security
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="cursor-pointer rounded px-3 py-2 text-sm outline-none hover:bg-accent"
            onSelect={async () => {
              await authClient.signOut();
              router.push("/admin/login");
              router.refresh();
            }}
          >
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
