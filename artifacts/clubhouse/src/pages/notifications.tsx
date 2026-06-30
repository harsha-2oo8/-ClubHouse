import { Link } from "wouter";
import { useAuth } from "@clerk/react";
import { Bell, CheckCheck, ChevronRight } from "lucide-react";
import {
  useGetNotifications, getGetNotificationsQueryKey,
  useMarkNotificationRead, useMarkAllNotificationsRead,
  useGetMyProfile, getGetMyProfileQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import { cn } from "@/lib/utils";

function groupByDate(items: Array<Record<string, unknown>>) {
  const groups: Record<string, Array<Record<string, unknown>>> = {};
  for (const item of items) {
    const date = new Date(String(item.createdAt));
    const key = isToday(date) ? "Today" : isYesterday(date) ? "Yesterday" : format(date, "MMMM d, yyyy");
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return groups;
}

const typeIcons: Record<string, string> = {
  join_request_approved: "bg-green-500/10 text-green-600",
  moderator_approved: "bg-purple-500/10 text-purple-600",
  project_application: "bg-blue-500/10 text-blue-600",
  project_application_approved: "bg-green-500/10 text-green-600",
  college_meeting: "bg-primary/10 text-primary",
  project_meeting: "bg-primary/10 text-primary",
  college_approved: "bg-green-500/10 text-green-600",
  college_rejected: "bg-red-500/10 text-red-600",
};

export default function NotificationsPage() {
  const { isSignedIn } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: profile } = useGetMyProfile({ query: { queryKey: getGetMyProfileQueryKey(), enabled: !!isSignedIn } });
  const { data: notifications, isLoading } = useGetNotifications({
    query: { queryKey: getGetNotificationsQueryKey(), enabled: !!isSignedIn }
  });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const typedNotifications = (notifications as Array<Record<string, unknown>>) ?? [];
  const typedProfile = profile as { role?: string } | null | undefined;
  const groups = groupByDate(typedNotifications);
  const unreadCount = typedNotifications.filter(n => !n.read).length;

  async function handleMarkAllRead() {
    try {
      await markAllRead.mutateAsync();
      qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
      toast({ title: "All notifications marked as read" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  }

  async function handleMarkRead(id: number) {
    try {
      await markRead.mutateAsync({ notificationId: id });
      qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
    } catch {
      // silent
    }
  }

  return (
    <AppLayout userRole={typedProfile?.role}>
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-muted-foreground text-sm mt-0.5">{unreadCount} unread</p>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleMarkAllRead}
              disabled={markAllRead.isPending}
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="h-4 w-4" /> Mark all read
            </Button>
          )}
        </div>

        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3 mb-4">
              <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-4 w-full mb-1.5" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))
        ) : typedNotifications.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No notifications yet</p>
            <p className="text-sm">We'll notify you of activity on your clubs and projects</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groups).map(([date, items]) => (
              <div key={date}>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{date}</h2>
                <div className="space-y-2">
                  {items.map(n => (
                    <div
                      key={String(n.id)}
                      className={cn(
                        "flex items-start gap-3 p-3.5 rounded-xl border transition-all",
                        n.read
                          ? "bg-background border-border"
                          : "bg-primary/3 border-primary/20 hover:border-primary/30"
                      )}
                      data-testid={`notification-${n.id}`}
                    >
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0", typeIcons[String(n.type)] ?? "bg-muted text-muted-foreground")}>
                        <Bell className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm", !n.read && "font-medium")} data-testid={`text-notification-${n.id}`}>
                          {String(n.message)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(String(n.createdAt)), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {n.linkUrl && (
                          <Link href={String(n.linkUrl)}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid={`link-notification-${n.id}`}>
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                        {!n.read && (
                          <button
                            onClick={() => handleMarkRead(Number(n.id))}
                            className="w-2 h-2 rounded-full bg-primary flex-shrink-0"
                            data-testid={`button-read-${n.id}`}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
