import type { Permission, Role } from "@/lib/permissions";

export type Actor = {
  id: string;
  email: string;
  name: string;
  role: Role;
  clientId: string | null;
  permissions: ReadonlySet<Permission>;
};

export type ShellUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  permissions: Permission[];
};

export function toShellUser(actor: Actor): ShellUser {
  return {
    id: actor.id,
    email: actor.email,
    name: actor.name,
    role: actor.role,
    permissions: [...actor.permissions],
  };
}
