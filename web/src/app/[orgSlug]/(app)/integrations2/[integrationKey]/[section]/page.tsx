import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Integration2DetailSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ integrationKey: string; orgSlug: string; section: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { integrationKey, orgSlug, section } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry) {
          query.append(key, entry);
        }
      }
      continue;
    }

    if (value) {
      query.set(key, value);
    }
  }

  const queryString = query.toString();
  redirect(
    `/${orgSlug}/integrations/${integrationKey}/${section}${queryString ? `?${queryString}` : ""}`,
  );
}
