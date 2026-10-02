"use client";

import { useEffect, useId, useRef } from "react";
import { CircleHelp, X } from "lucide-react";
import { LOCAL_APP_HELP } from "@/lib/local-app-help";
import { DOWNLOADS } from "@/lib/downloads";
import { trackEvent } from "@/lib/analytics";
import { withBasePath } from "@/lib/build-mode";
import type { LocalServerStatus } from "@/lib/media/local-server-status";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverStatus: LocalServerStatus;
};

export function LocalAppHelpButton({ open, onOpenChange, serverStatus }: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const needsAttention =
    serverStatus.mode === "remote" && serverStatus.state !== "online";

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
      triggerRef.current?.focus();
    };
  }, [open, onOpenChange]);

  const statusLabel =
    serverStatus.mode === "embedded"
      ? LOCAL_APP_HELP.statusEmbedded
      : serverStatus.state === "online"
        ? LOCAL_APP_HELP.statusOnline
        : serverStatus.state === "checking"
          ? LOCAL_APP_HELP.statusChecking
          : LOCAL_APP_HELP.statusOffline;

  const statusClass =
    serverStatus.state === "online"
      ? "is-online"
      : serverStatus.state === "checking"
        ? "is-checking"
        : "is-offline";

  const tip = `${statusLabel} · ${LOCAL_APP_HELP.buttonLabel}`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`tool-button local-app-help-trigger ${statusClass}${needsAttention ? " is-attention" : ""}`}
        aria-label={tip}
        title={tip}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => onOpenChange(true)}
      >
        <span className="local-server-dot" aria-hidden="true" />
        <CircleHelp size={18} aria-hidden="true" />
      </button>

      {open && (
        <div
          className="local-app-help-overlay"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) onOpenChange(false);
          }}
        >
          <div
            className="local-app-help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="local-app-help-header">
              <h2 id={titleId} className="local-app-help-title">
                {LOCAL_APP_HELP.dialogTitle}
              </h2>
              <button
                ref={closeRef}
                type="button"
                className="tool-button local-app-help-close"
                aria-label="关闭"
                onClick={() => onOpenChange(false)}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <p className="local-app-help-lead">{LOCAL_APP_HELP.lead}</p>

            <h3 className="local-app-help-section">{LOCAL_APP_HELP.downloadTitle}</h3>
            <div className="local-app-help-downloads" role="group" aria-label="下载扫片本机程序">
              {Object.values(DOWNLOADS).map((item) => (
                <a
                  key={item.platform}
                  className="local-app-help-download"
                  href={withBasePath(item.href)}
                  download={item.file}
                  onClick={() => trackEvent("download_click", { platform: item.platform })}
                >
                  {item.label}
                </a>
              ))}
            </div>

            <h3 className="local-app-help-section">{LOCAL_APP_HELP.stepsTitle}</h3>
            <ol className="local-app-help-steps">
              {LOCAL_APP_HELP.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>

            <h3 className="local-app-help-section">{LOCAL_APP_HELP.macOpenTitle}</h3>
            <ol className="local-app-help-steps">
              {LOCAL_APP_HELP.macOpenSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>

            <h3 className="local-app-help-section">{LOCAL_APP_HELP.notesTitle}</h3>
            <ul className="local-app-help-notes">
              {LOCAL_APP_HELP.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
