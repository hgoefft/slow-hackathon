"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart2, Lightbulb, Mail, Settings, RefreshCw, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { UserButton } from "@/components/user-button"

const navItems = [
  { href: "/dashboard", label: "Performance", icon: BarChart2 },
  { href: "/ideas", label: "Ideas", icon: Lightbulb },
  { href: "/briefing", label: "Briefing", icon: Mail },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 min-h-screen border-r border-border flex flex-col bg-background shrink-0">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm tracking-tight">Content Hub</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Hanna Gets Hired</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              pathname === href || pathname.startsWith(href + "/")
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-border">
        <UserButton />
      </div>
    </aside>
  )
}
