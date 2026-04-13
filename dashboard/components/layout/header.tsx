"use client";

import { ConnectionStatusIndicator } from "@/components/connection-status";

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <header className="shrink-0 border-b border-border bg-card/50 backdrop-blur-sm px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {actions}
          <ConnectionStatusIndicator />
        </div>
      </div>
    </header>
  );
}
