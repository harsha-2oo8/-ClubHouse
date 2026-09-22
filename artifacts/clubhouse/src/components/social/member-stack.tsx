import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface MemberStackProps {
  members: Array<Record<string, unknown>>;
  max?: number;
  size?: "sm" | "md";
  className?: string;
}

/** Overlapping avatar stack with +N overflow. */
export function MemberStack({ members, max = 4, size = "sm", className }: MemberStackProps) {
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  const dims = size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs";
  return (
    <div className={cn("flex items-center", className)}>
      {shown.map((m, i) => (
        <Avatar
          key={String(m.clerkId ?? m.id ?? i)}
          className={cn(dims, "border-2 border-card font-bold", i > 0 && "-ml-2.5")}
          title={String(m.name ?? "")}
        >
          <AvatarImage src={String(m.avatarUrl ?? "")} />
          <AvatarFallback className="bg-primary/10 text-primary">
            {String(m.name ?? "U").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ))}
      {extra > 0 && (
        <span className={cn("flex items-center justify-center rounded-full bg-muted text-muted-foreground font-semibold border-2 border-card -ml-2.5", dims)}>
          +{extra}
        </span>
      )}
    </div>
  );
}
