import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ScheduledTaskSetupPage({
  params,
}: {
  params: Promise<{ orgSlug: string; taskKey: string }>;
}) {
  const { orgSlug, taskKey } = await params;

  redirect(
    `/${orgSlug}/scheduled-tasks/tasks/${encodeURIComponent(taskKey)}/overview`,
  );
}
