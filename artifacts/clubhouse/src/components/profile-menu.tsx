import { UserButton } from "@clerk/react";
import { Bell, UserRound } from "lucide-react";

/**
 * Production profile menu: account management plus quick links into the app.
 * No development labels — Clerk renders its own production UI once the
 * instance uses pk_live_… keys.
 */
export function ProfileMenu() {
  return (
    <UserButton
      appearance={{
        elements: {
          userButtonPopoverCard: "shadow-xl border border-border",
        },
      }}
    >
      <UserButton.MenuItems>
        <UserButton.Link
          label="My profile"
          labelIcon={<UserRound className="h-4 w-4" />}
          href="/profile/me"
        />
        <UserButton.Link
          label="Notifications"
          labelIcon={<Bell className="h-4 w-4" />}
          href="/notifications"
        />
        <UserButton.Action label="manageAccount" />
      </UserButton.MenuItems>
    </UserButton>
  );
}
