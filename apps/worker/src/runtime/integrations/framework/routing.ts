export function buildIntegrationSectionPath(input: {
  integrationKey: string;
  orgSlug: string;
  section: string;
}) {
  const orgSlug = encodeURIComponent(input.orgSlug);
  const integrationKey = encodeURIComponent(input.integrationKey);
  const section = encodeURIComponent(input.section);

  return `/${orgSlug}/integrations2/${integrationKey}/${section}`;
}
