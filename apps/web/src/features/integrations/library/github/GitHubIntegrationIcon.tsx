import { cn } from "@/lib/utils"

export interface GitHubIntegrationIconProps {
  alt: string
  className?: string
}

export function GitHubIntegrationIcon({
  alt,
  className,
}: GitHubIntegrationIconProps) {
  return (
    <>
      <img
        alt={alt}
        className={cn(className, "dark:hidden")}
        src="/integrations/github.svg"
      />
      <img
        alt={alt}
        className={cn(className, "hidden dark:block")}
        src="/integrations/github-dark.svg"
      />
    </>
  )
}
