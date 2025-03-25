import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { cn } from "@/lib/utils";

interface AlertDialogProps {
  title: string;
  description: string;
  onClose: () => void;
  className?: string;
}

export function AlertDialog({ title, description, onClose, className }: AlertDialogProps) {
  return (
    <AlertDialogPrimitive.Root defaultOpen>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay
          className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out"
        />
        <AlertDialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-white p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out sm:rounded-lg",
            className
          )}
        >
          <AlertDialogPrimitive.Title className="text-lg font-semibold">
            {title}
          </AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description className="text-sm text-gray-500">
            {description}
          </AlertDialogPrimitive.Description>
          <div className="flex justify-end">
            <AlertDialogPrimitive.Cancel
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center rounded-md bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200"
            >
              Close
            </AlertDialogPrimitive.Cancel>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
} 