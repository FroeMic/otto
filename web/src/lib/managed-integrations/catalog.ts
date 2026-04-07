export type {
  IntegrationDefinition as ManagedIntegrationDefinition,
  IntegrationOperationDefinition as ManagedIntegrationOperation,
  IntegrationRuntimeToolDefinition as ManagedIntegrationRuntimeTool,
} from "@/integrations/framework";
export {
  getIntegrationDefinition as getManagedIntegrationDefinition,
  listIntegrationDefinitions as listManagedIntegrationDefinitions,
  listRuntimeIntegrationDefinitions as listRuntimeManagedIntegrationDefinitions,
  listWorkspaceIntegrationDefinitions as listWorkspaceManagedIntegrationDefinitions,
} from "@/integrations/framework";
