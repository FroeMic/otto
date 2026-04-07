import assert from "node:assert/strict";
import test from "node:test";

import {
  buildManagedSkillMarkdown,
  classifyManagedSkillFile,
  listKnownManagedSkillDependencyIntegrationKeys,
  normalizeManagedSkillKey,
  parseManagedSkillMarkdown,
  parseManagedSkillSkillFile,
  validateManagedSkillPackage,
} from "@/lib/managed-skills/package";

test("normalizeManagedSkillKey creates a stable slug", () => {
  assert.equal(normalizeManagedSkillKey(" Linear_Triage "), "linear-triage");
  assert.throws(() => normalizeManagedSkillKey("linear/triage"));
});

test("parseManagedSkillSkillFile reads nested dependency metadata", () => {
  const parsed = parseManagedSkillSkillFile(`---
name: linear-triage
description: Triage bugs with our team rules.
metadata:
  dependsOn:
    integrations:
      - linear
      - slack
---

# Linear Triage
`);

  assert.equal(parsed.name, "linear-triage");
  assert.equal(parsed.description, "Triage bugs with our team rules.");
  assert.deepEqual(parsed.metadata.dependsOn.integrations, ["linear", "slack"]);
});

test("managed skill markdown helpers round-trip structured metadata and body", () => {
  const content = buildManagedSkillMarkdown({
    description: "Triage bugs with our team rules.",
    integrationKeys: ["slack", "linear", "linear"],
    name: "linear-triage",
    skillBody: "\n# Linear Triage\n\nFollow the workflow.\n",
  });

  const parsed = parseManagedSkillMarkdown(content);

  assert.equal(parsed.name, "linear-triage");
  assert.equal(parsed.description, "Triage bugs with our team rules.");
  assert.deepEqual(parsed.integrationKeys, ["linear", "slack"]);
  assert.equal(parsed.skillBody, "# Linear Triage\n\nFollow the workflow.");
});

test("classifyManagedSkillFile distinguishes managed, binary, and local state paths", () => {
  assert.deepEqual(
    classifyManagedSkillFile({
      contentText: "# Notes",
      path: "references/notes.md",
    }),
    {
      editability: "editable",
      fileKind: "managed",
      path: "references/notes.md",
      storageEncoding: "utf8_text",
    },
  );

  assert.deepEqual(
    classifyManagedSkillFile({
      path: "assets/logo.png",
    }),
    {
      editability: "download_only",
      fileKind: "managed",
      path: "assets/logo.png",
      storageEncoding: "binary",
    },
  );

  assert.deepEqual(
    classifyManagedSkillFile({
      contentText: '{"cached":true}',
      path: "state/cache.json",
    }),
    {
      editability: "local_state",
      fileKind: "state",
      path: "state/cache.json",
      storageEncoding: "utf8_text",
    },
  );
});

test("validateManagedSkillPackage accepts a valid package and classifies files", () => {
  const validated = validateManagedSkillPackage({
    files: [
      {
        contentText: `---
name: linear-triage
description: Triage bugs with our team rules.
metadata:
  dependsOn:
    integrations:
      - linear
      - slack
---

# Linear Triage
`,
        path: "SKILL.md",
      },
      {
        contentText: "## Team conventions",
        path: "references/conventions.md",
      },
      {
        path: "assets/logo.png",
      },
    ],
    skillKey: "Linear Triage",
  });

  assert.equal(validated.skillKey, "linear-triage");
  assert.equal(validated.name, "linear-triage");
  assert.deepEqual(validated.dependencies.integrations, ["linear", "slack"]);
  assert.deepEqual(
    validated.files.map((file) => [file.path, file.editability]),
    [
      ["assets/logo.png", "download_only"],
      ["references/conventions.md", "editable"],
      ["SKILL.md", "editable"],
    ],
  );
});

test("validateManagedSkillPackage rejects reserved state writes and unknown integrations", () => {
  assert.throws(
    () =>
      validateManagedSkillPackage({
        files: [
          {
            contentText: `---
name: support-routing
description: Route support questions.
---
`,
            path: "SKILL.md",
          },
          {
            contentText: "runtime cache",
            path: "state/cache.json",
          },
        ],
        skillKey: "support-routing",
      }),
    /reserved local state path/i,
  );

  assert.throws(
    () =>
      validateManagedSkillPackage({
        files: [
          {
            contentText: `---
name: support-routing
description: Route support questions.
metadata:
  dependsOn:
    integrations:
      - not-real
---
`,
            path: "SKILL.md",
          },
        ],
        skillKey: "support-routing",
      }),
    /unknown integration keys/i,
  );
});

test("known managed skill dependency keys cover current workspace integrations", () => {
  const keys = listKnownManagedSkillDependencyIntegrationKeys();

  assert.ok(keys.includes("linear"));
  assert.ok(keys.includes("slack"));
  assert.ok(keys.includes("whatsapp"));
});
