import type {
  WorkspaceChatMessage,
  WorkspaceChatMessageEvent,
} from "@otto/feature-workspace-chat";

import type {
  WorkspaceChatActivityEntry,
  WorkspaceChatActivityModel,
} from "./activity-model";

export const WORKSPACE_CHAT_LOADING_VERBS = [
  "Accomplishing",
  "Actioning",
  "Actualizing",
  "Architecting",
  "Bootstrapping",
  "Brewing",
  "Calculating",
  "Cerebrating",
  "Choreographing",
  "Cogitating",
  "Composing",
  "Concocting",
  "Considering",
  "Contemplating",
  "Cooking",
  "Crafting",
  "Crunching",
  "Deciphering",
  "Deliberating",
  "Determining",
  "Doing",
  "Forging",
  "Generating",
  "Grooving",
  "Hashing",
  "Ideating",
  "Imagining",
  "Improvising",
  "Inferring",
  "Manifesting",
  "Marinating",
  "Mulling",
  "Musing",
  "Orbiting",
  "Perusing",
  "Noodling",
  "Orchestrating",
  "Percolating",
  "Pondering",
  "Processing",
  "Proofing",
  "Puzzling",
  "Ruminating",
  "Scheming",
  "Simmering",
  "Sketching",
  "Stewing",
  "Sussing",
  "Synthesizing",
  "Tempering",
  "Thinking",
  "Tinkering",
  "Working",
  "Wrangling",
] as const;

const LOADING_VERB_INTERVAL_MS = 5000;

export function getWorkspaceChatLoadingVerb(input: {
  elapsedMs: number;
  seed?: string;
}) {
  const intervalIndex =
    input.elapsedMs <= 0
      ? 0
      : Math.floor(input.elapsedMs / LOADING_VERB_INTERVAL_MS);
  const verbIndex = resolveLoadingVerbIndex({
    intervalIndex,
    seed: input.seed,
  });

  return WORKSPACE_CHAT_LOADING_VERBS[verbIndex];
}

export function getWorkspaceChatPendingLabel(input: {
  elapsedMs: number;
  seed?: string;
  status:
    | WorkspaceChatMessage["status"]
    | WorkspaceChatMessageEvent["status"]
    | undefined;
}) {
  if (input.status === "failed") {
    return "Otto could not complete this reply.";
  }

  if (input.status === "blocked") {
    return "Waiting for approval…";
  }

  if (
    input.status === "pending" ||
    input.status === "running" ||
    input.status === "streaming"
  ) {
    return `${getWorkspaceChatLoadingVerb({
      elapsedMs: input.elapsedMs,
      seed: input.seed,
    })}…`;
  }

  return null;
}

function resolveLoadingVerbIndex(input: {
  intervalIndex: number;
  seed?: string;
}): number {
  const index = hashLoadingVerbSeed(
    `${input.seed ?? "workspace-chat"}:${input.intervalIndex}`,
  ) % WORKSPACE_CHAT_LOADING_VERBS.length;

  if (input.intervalIndex <= 0) {
    return index;
  }

  const previousIndex: number = resolveLoadingVerbIndex({
    intervalIndex: input.intervalIndex - 1,
    seed: input.seed,
  });

  return index === previousIndex
    ? (index + 1) % WORKSPACE_CHAT_LOADING_VERBS.length
    : index;
}

function hashLoadingVerbSeed(seed: string) {
  let hash = 2166136261;

  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  return hash;
}

export function formatWorkspaceChatActivityDuration(input: {
  endAt?: string;
  now: number;
  startedAt: string;
}) {
  const startedAtMs = Date.parse(input.startedAt);
  const endAtMs = input.endAt ? Date.parse(input.endAt) : input.now;

  if (!Number.isFinite(startedAtMs) || !Number.isFinite(endAtMs)) {
    return "Worked recently";
  }

  const elapsedSeconds = Math.max(
    1,
    Math.round((Math.max(endAtMs, startedAtMs) - startedAtMs) / 1000),
  );

  return `Worked for ${formatDurationSeconds(elapsedSeconds)}`;
}

export function getLatestVisibleActivityEntry(
  activityModel: WorkspaceChatActivityModel,
) {
  return activityModel.sections
    .flatMap((section) => section.entries)
    .filter((entry) => entry.visibility !== "debug")
    .sort((left, right) => right.lastSequence - left.lastSequence)[0];
}

export function getActivityLeadLine(input: {
  activityModel: WorkspaceChatActivityModel;
  fallback: string;
}) {
  const latestEntry = getLatestVisibleActivityEntry(input.activityModel);

  if (!latestEntry) {
    return input.fallback;
  }

  return latestEntry.summary ?? latestEntry.title;
}

export function getActivityLeadTitle(input: {
  activityModel: WorkspaceChatActivityModel;
  fallback: string;
}) {
  const latestEntry = getLatestVisibleActivityEntry(input.activityModel);

  if (!latestEntry) {
    return input.fallback;
  }

  return latestEntry.title;
}

export function getActiveTraceLabel(input: {
  activityModel: WorkspaceChatActivityModel;
  fallback: string;
}) {
  const latestEntry = getLatestVisibleActivityEntry(input.activityModel);

  if (!latestEntry) {
    return input.fallback;
  }

  return latestEntry.title;
}

function formatDurationSeconds(totalSeconds: number) {
  if (totalSeconds < 60) {
    return `${totalSeconds} second${totalSeconds === 1 ? "" : "s"}`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (seconds === 0) {
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  return `${minutes} minute${minutes === 1 ? "" : "s"} ${seconds} second${seconds === 1 ? "" : "s"}`;
}
