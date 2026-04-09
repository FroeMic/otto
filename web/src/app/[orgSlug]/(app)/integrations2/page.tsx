import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Integrations2Page({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgSlug } = await params;
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
  redirect(`/${orgSlug}/integrations${queryString ? `?${queryString}` : ""}`);
}
