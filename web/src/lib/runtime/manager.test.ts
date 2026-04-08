import assert from "node:assert/strict";
import test from "node:test";

import {
  buildManagedSkillManifest,
  buildManagedSkillPruneCommand,
  parseManagedSkillManifest,
} from "@/lib/runtime/manager";

test("buildManagedSkillManifest normalizes and sorts projected skill paths", () => {
  const manifest = buildManagedSkillManifest([
    {
      contents: "# Triage",
      filename: "skills/linear-triage/SKILL.md",
    },
    {
      contents: "## Notes",
      filename: "skills/linear-triage/references/rules.md",
    },
    {
      contents: "# Triage",
      filename: "skills/linear-triage/SKILL.md",
    },
  ]);

  assert.deepEqual(manifest, {
    files: [
      "/opt/openclaw/home/workspace/skills/linear-triage/references/rules.md",
      "/opt/openclaw/home/workspace/skills/linear-triage/SKILL.md",
    ],
  });
});

test("parseManagedSkillManifest ignores invalid entries", () => {
  const manifest = parseManagedSkillManifest(
    JSON.stringify({
      files: [
        "/opt/openclaw/home/workspace/skills/a/SKILL.md",
        123,
        "/opt/openclaw/home/workspace/skills/a/SKILL.md",
      ],
    }),
  );

  assert.deepEqual(manifest, {
    files: ["/opt/openclaw/home/workspace/skills/a/SKILL.md"],
  });
});

test("buildManagedSkillPruneCommand only removes previously managed skill files", () => {
  const command = buildManagedSkillPruneCommand({
    nextPaths: ["/opt/openclaw/home/workspace/skills/linear-triage/SKILL.md"],
    previousPaths: [
      "/opt/openclaw/home/workspace/skills/linear-triage/SKILL.md",
      "/opt/openclaw/home/workspace/skills/linear-triage/notes.md",
      "/opt/openclaw/home/workspace/skills/linear-triage/references/rules.md",
      "/opt/openclaw/home/workspace/skills/linear-triage/scripts/refresh.sh",
      "/opt/openclaw/home/workspace/skills/linear-triage/state/cache.json",
      "/opt/openclaw/home/workspace/AGENTS.md",
    ],
  });

  assert.ok(command);
  assert.match(command ?? "", /notes\.md/);
  assert.doesNotMatch(command ?? "", /references\/rules\.md/);
  assert.doesNotMatch(command ?? "", /scripts\/refresh\.sh/);
  assert.doesNotMatch(command ?? "", /state\/cache\.json/);
  assert.doesNotMatch(command ?? "", /workspace\/AGENTS\.md/);
});

test("buildManagedSkillPruneCommand returns null when nothing was removed", () => {
  assert.equal(
    buildManagedSkillPruneCommand({
      nextPaths: ["/opt/openclaw/home/workspace/skills/linear-triage/SKILL.md"],
      previousPaths: [
        "/opt/openclaw/home/workspace/skills/linear-triage/SKILL.md",
      ],
    }),
    null,
  );
});
