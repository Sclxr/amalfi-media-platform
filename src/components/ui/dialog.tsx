"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function Modal({
  title,
  description,
  trigger,
  children,
  open,
  onOpenChange,
}: {
  title: string;
  description?: string;
  trigger?: ReactNode;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[min(90vh,40rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-md border border-border bg-card p-5 text-card-foreground shadow-lg">
          <Dialog.Title className="text-lg font-semibold tracking-tight">{title}</Dialog.Title>
          {description ? <Dialog.Description className="mt-2 text-sm text-muted-foreground">{description}</Dialog.Description> : null}
          <div className={description ? "mt-4" : "mt-4"}>{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  trigger,
  action,
  hidden,
  destructive = false,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  trigger: ReactNode;
  action: (formData: FormData) => void | Promise<void>;
  hidden?: Record<string, string>;
  destructive?: boolean;
}) {
  return (
    <Modal title={title} description={body} trigger={trigger}>
      <form action={action} className="flex flex-wrap gap-2">
        {hidden
          ? Object.entries(hidden).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)
          : null}
        <button
          type="submit"
          className={
            destructive
              ? "inline-flex h-10 items-center rounded-md bg-destructive px-4 text-sm font-medium text-white"
              : "inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          }
        >
          {confirmLabel}
        </button>
        <Dialog.Close className="inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium">
          Cancel
        </Dialog.Close>
      </form>
    </Modal>
  );
}

export function AskConfirm({
  title,
  body,
  confirmLabel,
  trigger,
  onConfirm,
  destructive = false,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  trigger: ReactNode;
  onConfirm: () => void | Promise<void>;
  destructive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  return (
    <Modal title={title} description={body} trigger={trigger} open={open} onOpenChange={setOpen}>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={destructive ? "destructive" : "default"}
          onClick={() => {
            setOpen(false);
            startTransition(() => {
              void onConfirm();
            });
          }}
        >
          {confirmLabel}
        </Button>
        <Dialog.Close className="inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium">
          Cancel
        </Dialog.Close>
      </div>
    </Modal>
  );
}
