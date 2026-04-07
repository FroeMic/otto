export type {
  IntegrationCommandDefinition as ManagedIntegrationCommand,
  IntegrationDefinition as ManagedIntegrationDefinition,
  IntegrationRuntimeSurfaceDefinition as ManagedIntegrationRuntimeSurface,
} from "@/integrations/framework";
export {
  getIntegrationDefinition as getManagedIntegrationDefinition,
  listIntegrationDefinitions as listManagedIntegrationDefinitions,
  listRuntimeIntegrationDefinitions as listRuntimeManagedIntegrationDefinitions,
  listWorkspaceIntegrationDefinitions as listWorkspaceManagedIntegrationDefinitions,
} from "@/integrations/framework";
