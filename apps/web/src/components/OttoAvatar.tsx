import { cn } from "@/shared/cn"

export interface OttoAvatarProps {
  className?: string
  title?: string
}

export function OttoAvatar({
  className,
  title = "Otto avatar",
}: OttoAvatarProps) {
  return (
    <svg
      aria-label={title}
      className={cn("shrink-0", className)}
      role="img"
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <rect width="64" height="64" fill="#f9f3ea" />
      <rect x="18" y="6" width="28" height="6" fill="#5c341f" />
      <rect x="14" y="10" width="36" height="8" fill="#6f4328" />
      <rect x="12" y="18" width="40" height="6" fill="#7a4a2e" />
      <rect x="16" y="20" width="32" height="24" fill="#f0bf90" />
      <rect x="14" y="24" width="4" height="12" fill="#d77f54" />
      <rect x="46" y="24" width="4" height="12" fill="#d77f54" />
      <rect x="20" y="26" width="8" height="8" fill="#1e1a18" />
      <rect x="36" y="26" width="8" height="8" fill="#1e1a18" />
      <rect x="22" y="28" width="4" height="4" fill="#4ba1ff" />
      <rect x="38" y="28" width="4" height="4" fill="#4ba1ff" />
      <rect x="28" y="28" width="8" height="2" fill="#1e1a18" />
      <rect x="30" y="30" width="4" height="2" fill="#d77f54" />
      <rect x="29" y="34" width="6" height="4" fill="#cc7346" />
      <rect x="24" y="40" width="16" height="2" fill="#7a4a2e" />
      <rect x="19" y="44" width="26" height="4" fill="#c56743" />
      <rect x="18" y="48" width="28" height="4" fill="#b45a3a" />
      <rect x="12" y="46" width="12" height="12" fill="#f4e9d4" />
      <rect x="40" y="46" width="12" height="12" fill="#f4e9d4" />
      <rect x="20" y="52" width="24" height="10" fill="#f4e9d4" />
      <rect x="24" y="50" width="16" height="12" fill="#ffffff" />
      <rect x="14" y="56" width="10" height="6" fill="#e6dac3" />
      <rect x="40" y="56" width="10" height="6" fill="#e6dac3" />
      <rect x="44" y="52" width="4" height="8" fill="#0b57d0" />
      <rect x="48" y="54" width="4" height="6" fill="#c03232" />
      <rect x="14" y="14" width="4" height="4" fill="#59331e" />
      <rect x="46" y="14" width="4" height="4" fill="#59331e" />
    </svg>
  )
}
