"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Inbox,
  FileEdit,
  ListChecks,
  Zap,
  BarChart3,
  Briefcase,
  Database,
  Settings,
  Landmark,
  ChevronRight,
} from "lucide-react";

const PRIMARY_NAV = [
  { href: "/", label: "Opportunity Inbox", icon: Inbox },
  { href: "/bid-generator", label: "Bid Builder", icon: FileEdit },
  { href: "/bid-queue", label: "Bid Queue", icon: ListChecks },
  { href: "/fulfill", label: "Fulfill Contract", icon: Zap },
  { href: "/ops", label: "Operations", icon: Briefcase },
  { href: "/analytics", label: "Award Intel", icon: BarChart3 },
];

const SECONDARY_NAV = [
  { href: "/sources", label: "Data Sources", icon: Database },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  const isLoginPage = pathname === "/login" || pathname === "/signup";
  if (isLoginPage) return null;

  return (
    <aside className="sticky top-0 flex h-screen w-[220px] flex-col border-r border-border bg-sidebar shrink-0">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Landmark className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-[15px] font-semibold tracking-tight text-foreground">GovBot</span>
          <span className="text-[15px] font-semibold tracking-tight text-primary">AI</span>
        </div>
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 px-3 pt-2">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          Workflow
        </p>
        <ul className="space-y-0.5">
          {PRIMARY_NAV.map((item) => {
            const isActive =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                    isActive
                      ? "bg-primary/8 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2 : 1.5} />
                  {item.label}
                  {isActive && <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-50" />}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="my-4 border-t border-border" />

        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          System
        </p>
        <ul className="space-y-0.5">
          {SECONDARY_NAV.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                    isActive
                      ? "bg-primary/8 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2 : 1.5} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-[11px] text-muted-foreground">3 sources connected</span>
        </div>
      </div>
    </aside>
  );
}
