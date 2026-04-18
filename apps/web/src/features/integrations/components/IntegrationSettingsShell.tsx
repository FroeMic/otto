import type { ReactNode } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export interface IntegrationSettingsShellProps {
  capabilities: ReactNode
  capabilitiesLocked?: boolean
  capabilitiesLockedReason?: ReactNode
  channels?: ReactNode
  configuration?: ReactNode
  currentSection: string
  onSectionChange: (section: string) => void
  people?: ReactNode
  status: ReactNode
}

export function IntegrationSettingsShell({
  capabilities,
  capabilitiesLocked = false,
  capabilitiesLockedReason,
  channels,
  configuration,
  currentSection,
  onSectionChange,
  people,
  status,
}: IntegrationSettingsShellProps) {
  return (
    <Tabs className="flex flex-col gap-6" onValueChange={onSectionChange} value={currentSection}>
      <TabsList className="h-auto justify-start overflow-x-auto p-1">
        <TabsTrigger value="status">Status</TabsTrigger>
        <TabsTrigger disabled={capabilitiesLocked} value="capabilities">
          Capabilities
        </TabsTrigger>
        {configuration ? (
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
        ) : null}
        {people ? <TabsTrigger value="people">People</TabsTrigger> : null}
        {channels ? <TabsTrigger value="channels">Channels</TabsTrigger> : null}
      </TabsList>

      <TabsContent value="status">{status}</TabsContent>
      <TabsContent value="capabilities">
        {capabilitiesLocked ? (capabilitiesLockedReason ?? capabilities) : capabilities}
      </TabsContent>
      {configuration ? (
        <TabsContent value="configuration">{configuration}</TabsContent>
      ) : null}
      {people ? <TabsContent value="people">{people}</TabsContent> : null}
      {channels ? <TabsContent value="channels">{channels}</TabsContent> : null}
    </Tabs>
  )
}
