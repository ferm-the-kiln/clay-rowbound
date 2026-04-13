"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff, Copy, Check } from "lucide-react";
import { checkHealth } from "@/lib/api";
import type { ConnectionStatus } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function ConnectionStatusIndicator() {
  const [status, setStatus] = useState<ConnectionStatus>("checking");
  const [showDialog, setShowDialog] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function poll() {
      const healthy = await checkHealth();
      if (mounted) setStatus(healthy ? "connected" : "disconnected");
    }

    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const command = "rowbound watch YOUR_SHEET_ID --port 3001";

  function handleCopy() {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <button
        onClick={() => status === "disconnected" && setShowDialog(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors hover:bg-muted"
      >
        {status === "connected" && (
          <>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <Wifi className="w-4 h-4 text-emerald-500" />
            <span className="text-muted-foreground">Connected</span>
          </>
        )}
        {status === "disconnected" && (
          <>
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <WifiOff className="w-4 h-4 text-red-500" />
            <span className="text-muted-foreground">Connect</span>
          </>
        )}
        {status === "checking" && (
          <>
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-muted-foreground">Checking...</span>
          </>
        )}
      </button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Start Rowbound</DialogTitle>
            <DialogDescription>
              Rowbound needs to be running locally to process enrichments.
              Paste this command in your terminal:
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono">
              {command}
            </code>
            <Button variant="outline" size="icon" onClick={handleCopy}>
              {copied ? (
                <Check className="w-4 h-4 text-emerald-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Tip: Set up a LaunchAgent to auto-start Rowbound on login.
            Check Settings for setup instructions.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
