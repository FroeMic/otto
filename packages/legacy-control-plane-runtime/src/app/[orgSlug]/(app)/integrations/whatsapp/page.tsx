import { redirect } from "next/navigation";

type WhatsAppTab = "capabilities" | "configuration" | "status";

function resolveSection(tab: string | string[] | undefined): WhatsAppTab {
  const value = Array.isArray(tab) ? tab[0] : tab;

  if (
    value === "capabilities" ||
    value === "configuration" ||
    value === "status"
  ) {
    return value;
  }

  return "status";
}

export const dynamic = "force-dynamic";

export default async function LegacyWhatsAppIntegrationPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgSlug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const section = resolveSection(resolvedSearchParams.tab);

  redirect(`/${orgSlug}/integrations2/whatsapp/${section}`);
}
