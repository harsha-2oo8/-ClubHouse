import { shadcn } from "@clerk/themes";

const basePath = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const base = {
  baseTheme: shadcn,
  cssLayerName: "clerk",
  layout: {
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    logoPlacement: "inside" as const,
  },
  variables: {
    colorPrimary: "hsl(245, 80%, 58%)",
    borderRadius: "0.625rem",
    fontFamily: "Inter, system-ui, -apple-system, sans-serif",
  },
  elements: {
    card: "shadow-lg border border-border w-[440px] max-w-full",
    cardBox: "shadow-xl rounded-xl border border-border",
    formButtonPrimary: "bg-primary text-primary-foreground hover:opacity-90",
    footerActionLink: "text-primary hover:text-primary/80",
    socialButtonsIconButton: "border border-border hover:bg-muted",
    formFieldInput: "border-input bg-background",
    identityPreviewEditButton: "text-primary",
  },
};

export const clerkAppearance = {
  ...base,
  variables: {
    ...base.variables,
    colorBackground: "hsl(0, 0%, 100%)",
    colorText: "hsl(240, 10%, 8%)",
    colorInputBackground: "hsl(0, 0%, 100%)",
    colorInputText: "hsl(240, 10%, 8%)",
  },
};

export const clerkAppearanceDark = {
  ...base,
  variables: {
    ...base.variables,
    colorBackground: "hsl(240, 14%, 10%)",
    colorText: "hsl(0, 0%, 95%)",
    colorInputBackground: "hsl(240, 12%, 16%)",
    colorInputText: "hsl(0, 0%, 95%)",
    colorTextSecondary: "hsl(240, 6%, 70%)",
    colorNeutral: "hsl(0, 0%, 95%)",
  },
  elements: {
    ...base.elements,
    card: "shadow-lg border border-border bg-[#16161f] w-[440px] max-w-full",
    cardBox: "shadow-xl rounded-xl border border-border bg-[#16161f]",
  },
};

/** Theme-aware Clerk appearance — dark mode gets a real dark card, not a forced-white one. */
export function clerkAppearanceFor(mode: string | undefined) {
  return mode === "dark" ? clerkAppearanceDark : clerkAppearance;
}
