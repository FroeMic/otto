import { useNavigate } from "@tanstack/react-router"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export interface SkillsNavigationProps {
  currentSection: "installed" | "library"
  orgSlug: string
}

export function SkillsNavigation({
  currentSection,
  orgSlug,
}: SkillsNavigationProps) {
  const navigate = useNavigate()

  return (
    <Tabs
      onValueChange={(nextValue) => {
        const nextSection = nextValue as SkillsNavigationProps["currentSection"]
        void navigate({
          params: {
            orgSlug,
          },
          to:
            nextSection === "library"
              ? "/$orgSlug/skills/library"
              : "/$orgSlug/skills/installed",
        })
      }}
      value={currentSection}
    >
      <TabsList className="h-auto justify-start overflow-x-auto p-1">
        <TabsTrigger value="installed">Installed</TabsTrigger>
        <TabsTrigger value="library">Library</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
