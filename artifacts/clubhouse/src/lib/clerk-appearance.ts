import { shadcn } from "@clerk/themes";

const basePath = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export const clerkAppearance = {
  baseTheme: shadcn,
  cssLayerName: "clerk",
  layout: {
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    logoPlacement: "inside" as const,
  },
  variables: {
    colorPrimary: "hsl(245, 80%, 58%)",
    colorBackground: "hsl(0, 0%, 100%)",
    colorText: "hsl(240, 10%, 8%)",
    colorInputBackground: "hsl(0, 0%, 100%)",
    colorInputText: "hsl(240, 10%, 8%)",
    borderRadius: "0.625rem",
    fontFamily: "Inter, system-ui, -apple-system, sans-serif",
  },
  elements: {
    card: "bg-white shadow-lg border border-border w-[440px] max-w-full",
    cardBox: "bg-white shadow-xl rounded-xl border border-border",
    formButtonPrimary: "bg-primary text-primary-foreground hover:opacity-90",
    footerActionLink: "text-primary hover:text-primary/80",
    socialButtonsIconButton: "border border-border hover:bg-muted",
    formFieldInput: "border-input bg-background",
    identityPreviewEditButton: "text-primary",
  },
};
