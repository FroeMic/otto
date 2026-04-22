import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import {
  SettingsCard,
  SettingsRow,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowTitle,
} from "@/client/app/app-shell/SettingsLayout"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const themeOptions = [
  { label: "System preference", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
] as const

export function ThemeSettingsCard() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <SettingsCard>
      <SettingsRow>
        <SettingsRowLabel>
          <SettingsRowTitle>Interface theme</SettingsRowTitle>
          <SettingsRowDescription>
            Choose how Otto looks for you
          </SettingsRowDescription>
        </SettingsRowLabel>
        {mounted ? (
          <Select
            value={theme ?? "system"}
            onValueChange={(value) => setTheme(value ?? "system")}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {themeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="h-9 w-44 animate-pulse rounded-3xl bg-input/50" />
        )}
      </SettingsRow>
    </SettingsCard>
  )
}
