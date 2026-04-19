#!/usr/bin/env node
const prefixes = ["use", "get", "go", "try", "with", "join", "hey"];
const suffixes = ["hq", "app", "labs", "os", "now", "run"];
const defaultTlds = ["com", "co", "io", "ai", "so", "inc", "org"];

function normalizeBaseName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function expandDomainCandidates(baseName, tlds = defaultTlds) {
  const normalizedBaseName = normalizeBaseName(baseName);

  if (!normalizedBaseName) {
    throw new Error("Provide a non-empty base name.");
  }

  const names = new Set([normalizedBaseName]);

  for (const prefix of prefixes) {
    names.add(`${prefix}${normalizedBaseName}`);
  }

  for (const suffix of suffixes) {
    names.add(`${normalizedBaseName}${suffix}`);
  }

  const domains = [];

  for (const name of names) {
    for (const tld of tlds) {
      domains.push(`${name}.${tld}`);
    }
  }

  return domains;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , baseName, ...tlds] = process.argv;
  const domains = expandDomainCandidates(baseName ?? "", tlds.length > 0 ? tlds : defaultTlds);

  for (const domain of domains) {
    console.log(domain);
  }
}

export { expandDomainCandidates };
