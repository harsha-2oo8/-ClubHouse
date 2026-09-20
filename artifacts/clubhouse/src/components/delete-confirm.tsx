import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TriangleAlert } from "lucide-react";

interface DeleteConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** e.g. 'Delete project' */
  title: string;
  /** Plain-language statement, e.g. 'You are about to permanently remove …' */
  statement: string;
  /** Bulleted consequences shown before confirming. */
  consequences?: string[];
  /**
   * When true (dangerous resources: projects, clubs), the user must type
   * DELETE to enable the confirm button. Smaller resources use plain confirm.
   */
  requireTyping?: boolean;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => void | Promise<void>;
}

/**
 * Shared destructive-action confirmation. Never deletes on a single click:
 * always an explicit dialog, and typed confirmation for dangerous resources.
 */
export function DeleteConfirm({
  open,
  onOpenChange,
  title,
  statement,
  consequences = [],
  requireTyping = false,
  confirmLabel = "Delete",
  pending = false,
  onConfirm,
}: DeleteConfirmProps) {
  const [typed, setTyped] = useState("");
  const canConfirm = !requireTyping || typed.trim().toUpperCase() === "DELETE";

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTyped("");
        onOpenChange(next);
      }}
    >
      <AlertDialogContent data-testid="dialog-delete-confirm">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <TriangleAlert className="h-5 w-5" />
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-3 pt-1">
              <p>{statement}</p>
              {consequences.length > 0 && (
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {consequences.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              )}
              {requireTyping && (
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Type <span className="font-mono font-bold">DELETE</span> to confirm
                  </p>
                  <Input
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder="DELETE"
                    className="mt-2"
                    data-testid="input-delete-confirm"
                    autoComplete="off"
                  />
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-delete-cancel">Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={!canConfirm || pending}
            onClick={() => void onConfirm()}
            data-testid="button-delete-confirm"
          >
            {pending ? "Deleting…" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
