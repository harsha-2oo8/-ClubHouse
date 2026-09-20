import { useState } from "react";
import { useCreateReport } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const reportSchema = z.object({
  reason: z.string().min(1, "Choose a reason"),
  description: z.string().max(2000).optional(),
});

type ReportValues = z.infer<typeof reportSchema>;

const REASONS = [
  "Spam or misleading",
  "Harassment or hate",
  "Inappropriate content",
  "Fake or impersonation",
  "Something else",
];

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: "project" | "club" | "event" | "profile";
  targetId: string;
  targetLabel: string;
}

/** Report abusive/misleading content. Resolution is admin-only. */
export function ReportDialog({ open, onOpenChange, targetType, targetId, targetLabel }: ReportDialogProps) {
  const { toast } = useToast();
  const createReport = useCreateReport();
  const [reason, setReason] = useState("");

  const form = useForm<ReportValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: { reason: "", description: "" },
  });

  async function submit(values: ReportValues) {
    try {
      await createReport.mutateAsync({
        data: {
          targetType,
          targetId,
          reason: reason || values.reason,
          description: values.description || undefined,
        },
      });
      toast({ title: "Report submitted", description: "Moderators will review it." });
      form.reset();
      setReason("");
      onOpenChange(false);
    } catch {
      toast({ title: "Could not submit report", description: "You may have already reported this.", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Report {targetLabel}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <FormField
              control={form.control}
              name="reason"
              render={() => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <Select
                    value={reason}
                    onValueChange={(v) => {
                      setReason(v);
                      form.setValue("reason", v, { shouldValidate: true });
                    }}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-report-reason">
                        <SelectValue placeholder="Select a reason" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {REASONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Details (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={3} className="resize-none" placeholder="What should moderators know?" data-testid="input-report-details" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={createReport.isPending} data-testid="button-submit-report">
              {createReport.isPending ? "Submitting..." : "Submit report"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
