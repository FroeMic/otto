import { redirect } from "next/navigation";

export default async function ScheduledTaskPage({
  params,
}: {
  params: Promise<{ orgSlug: string; taskKey: string }>;
}) {
  const { orgSlug, taskKey } = await params;

  redirect(
    `/${orgSlug}/scheduled-tasks/tasks/${encodeURIComponent(taskKey)}/setup`,
  );
}
