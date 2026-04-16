import assert from "node:assert/strict";

import { describe, it, vi } from "vitest";

import { listProjectedManagedSkillFilesTx } from "./managed-skills";

function createSelectChain(result: unknown[]) {
  const chain = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    limit: vi.fn().mockResolvedValue(result),
    orderBy: vi.fn(() => chain),
    then: Promise.resolve(result).then.bind(Promise.resolve(result)),
    where: vi.fn(() => chain),
  };

  return chain;
}

describe("managed skill projection", () => {
  it("skips stale desired-state skill keys that no longer exist for the tenant", async () => {
    const selectResults = [
      [
        {
          skillId: "skill_name",
          skillKey: "name-and-domain-research",
        },
      ],
      [
        {
          id: "version_1",
        },
      ],
      [
        {
          contentEncoding: "utf8_text",
          contentText: "---\nname: Name Generator\n---\n",
          relativePath: "SKILL.md",
        },
        {
          contentEncoding: "utf8_text",
          contentText: "# Setup",
          relativePath: "references/setup.md",
        },
      ],
      [],
    ];
    const tx = {
      select: vi.fn(() => createSelectChain(selectResults.shift() ?? [])),
    };

    const result = await listProjectedManagedSkillFilesTx(tx as never, {
      tenantId: "tenant_123",
      versionMap: {
        "name-and-domain-research": 1,
        "random-color": 7,
      },
    });

    assert.deepEqual(result, [
      {
        contents: "---\nname: Name Generator\n---\n",
        projectionMode: "managed_entry",
        relativePath: "skills/name-and-domain-research/SKILL.md",
        skillKey: "name-and-domain-research",
      },
      {
        contents: "# Setup",
        projectionMode: "install_if_missing",
        relativePath: "skills/name-and-domain-research/references/setup.md",
        skillKey: "name-and-domain-research",
      },
    ]);
  });
});
