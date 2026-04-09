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
} from "./package";

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
    skills:
      - incident-triage-base
---

# Linear Triage
`);

  assert.equal(parsed.name, "linear-triage");
  assert.equal(parsed.description, "Triage bugs with our team rules.");
  assert.deepEqual(parsed.metadata.dependsOn.integrations, ["linear", "slack"]);
  assert.deepEqual(parsed.metadata.dependsOn.skills, ["incident-triage-base"]);
});

test("managed skill markdown helpers round-trip structured metadata and body", () => {
  const content = buildManagedSkillMarkdown({
    description: "Triage bugs with our team rules.",
    integrationKeys: ["slack", "linear", "linear"],
    name: "linear-triage",
    skillKeys: [
      "incident-triage-base",
      "writing-style-guide",
      "incident-triage-base",
    ],
    skillBody: "\n# Linear Triage\n\nFollow the workflow.\n",
  });

  const parsed = parseManagedSkillMarkdown(content);

  assert.equal(parsed.name, "linear-triage");
  assert.equal(parsed.description, "Triage bugs with our team rules.");
  assert.deepEqual(parsed.integrationKeys, ["linear", "slack"]);
  assert.deepEqual(parsed.skillKeys, [
    "incident-triage-base",
    "writing-style-guide",
  ]);
  assert.equal(parsed.skillBody, "# Linear Triage\n\nFollow the workflow.");
});

test("managed skill markdown helpers accept empty dependency lists", () => {
  const content = buildManagedSkillMarkdown({
    description: "Create workspace skills.",
    integrationKeys: [],
    name: "skill-creator",
    skillKeys: [],
    skillBody: "\n# Skill Creator\n\nFollow the workflow.\n",
  });

  const parsed = parseManagedSkillMarkdown(content);

  assert.equal(parsed.name, "skill-creator");
  assert.equal(parsed.description, "Create workspace skills.");
  assert.deepEqual(parsed.integrationKeys, []);
  assert.deepEqual(parsed.skillKeys, []);
  assert.equal(parsed.skillBody, "# Skill Creator\n\nFollow the workflow.");
});

test("classifyManagedSkillFile distinguishes managed, binary, and local state paths", () => {
  assert.deepEqual(
    classifyManagedSkillFile({
      contentText: "# Notes",
      path: "references/notes.md",
    }),
    {
      editability: "download_only",
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
    skills:
      - incident-triage-base
---

# Linear Triage
`,
        path: "SKILL.md",
      },
    ],
    knownSkillKeys: ["incident-triage-base", "writing-style-guide"],
    skillKey: "Linear Triage",
  });

  assert.equal(validated.skillKey, "linear-triage");
  assert.equal(validated.name, "linear-triage");
  assert.deepEqual(validated.dependencies.integrations, ["linear", "slack"]);
  assert.deepEqual(validated.dependencies.skills, ["incident-triage-base"]);
  assert.deepEqual(
    validated.files.map((file) => [file.path, file.editability]),
    [["SKILL.md", "editable"]],
  );
});

test("validateManagedSkillPackage rejects reserved state writes and unknown dependencies", () => {
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
---
`,
            path: "SKILL.md",
          },
          {
            contentText: "## Supplemental notes",
            path: "references/notes.md",
          },
        ],
        skillKey: "support-routing",
      }),
    /Only SKILL\.md can be stored as managed skill content/i,
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
    skills:
      - unknown-skill
---
`,
            path: "SKILL.md",
          },
        ],
        knownSkillKeys: ["support-routing"],
        skillKey: "support-routing",
      }),
    /unknown integration keys/i,
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
    skills:
      - not-real
---
`,
            path: "SKILL.md",
          },
        ],
        knownSkillKeys: ["support-routing"],
        skillKey: "support-routing",
      }),
    /unknown skill keys/i,
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
    skills:
      - support-routing
---
`,
            path: "SKILL.md",
          },
        ],
        knownSkillKeys: ["support-routing"],
        skillKey: "support-routing",
      }),
    /cannot depend on itself/i,
  );
});

test("known managed skill dependency keys cover current workspace integrations", () => {
  const keys = listKnownManagedSkillDependencyIntegrationKeys();

  assert.ok(keys.includes("linear"));
  assert.ok(keys.includes("slack"));
  assert.ok(keys.includes("whatsapp"));
});
