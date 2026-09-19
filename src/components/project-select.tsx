"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/types";

const selectClass = cn(
  "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground",
  "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "dark:bg-input/30",
);

function jobLabel(project: Project) {
  const name = project.name?.trim() || project.project_number?.trim() || project.id;
  return project.project_number && project.name?.trim()
    ? `${project.project_number} · ${project.name}`
    : name;
}

export function ProjectSelect({
  projects,
  value,
  onChange,
  allowNone = true,
}: {
  projects: Project[];
  value: string;
  onChange: (value: string) => void;
  allowNone?: boolean;
}) {
  const { workspace, syncBuildr, upsertProject } = useStore();
  const rows = [...(projects || []), ...(workspace.projects || [])].filter((row, index, all) => {
    const label = row?.name?.trim() || row?.project_number?.trim();
    if (!label) return false;
    return all.findIndex((item) => item.id === row.id || item.name === row.name) === index;
  });
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const tried = useRef(false);
  const linked = Boolean(workspace.settings.buildr_linked && workspace.settings.buildr_company_id.trim());
  const typed = value.trim();
  const known = new Set(rows.map((row) => row.name));
  const canSave = Boolean(typed) && !known.has(typed);

  const pullJobs = async () => {
    setSyncing(true);
    setMessage("");
    try {
      const result = await syncBuildr();
      if (!result.ok) {
        setMessage(result.error || "Buildr did not return any jobs.");
        return;
      }
      const count = result.count ?? 0;
      setMessage(result.warning || (count ? `Loaded ${count} job${count === 1 ? "" : "s"}.` : "Buildr returned no jobs."));
    } finally {
      setSyncing(false);
    }
  };

  const saveTypedJob = async () => {
    if (!canSave) return;
    setSaving(true);
    setMessage("");
    try {
      const result = await upsertProject({ name: typed, status: "active" });
      if (!result.ok) {
        setMessage(result.error || "Could not save that job.");
        return;
      }
      onChange(typed);
      setMessage(`Saved “${typed}” to this workspace.`);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (tried.current || rows.length || !linked) return;
    tried.current = true;
    void pullJobs();
  }, [linked, rows.length]);

  const active = rows.filter((row) => row.status !== "completed");
  const completed = rows.filter((row) => row.status === "completed");

  return (
    <div className="space-y-2">
      <select
        className={selectClass}
        value={value}
        disabled={false}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{allowNone ? "No project" : "Select a job"}</option>
        {value && !known.has(value) ? <option value={value}>{value}</option> : null}
        {active.map((project) => (
          <option key={project.id} value={project.name}>
            {jobLabel(project)}
          </option>
        ))}
        {completed.map((project) => (
          <option key={project.id} value={project.name}>
            {jobLabel(project)} (completed)
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <Input
          value={value}
          placeholder="Or type a job name"
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => {
            if (canSave) void saveTypedJob();
          }}
        />
        {canSave ? (
          <button
            type="button"
            className="shrink-0 text-xs underline"
            onClick={() => void saveTypedJob()}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save job"}
          </button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {syncing ? "Pulling jobs from Buildr… " : null}
        {message ? <span className={message.startsWith("Saved") || message.startsWith("Loaded") ? "" : "text-destructive"}>{message} </span> : null}
        {!rows.length && !syncing && !message ? (
          linked ? "No jobs in this workspace yet. " : "Link Buildr in Settings, or type a job name and save it. "
        ) : null}
        {linked ? (
          <button type="button" className="underline" onClick={() => void pullJobs()} disabled={syncing}>
            Sync jobs
          </button>
        ) : (
          <Link href="/settings" className="underline">
            Open Settings
          </Link>
        )}
      </p>
    </div>
  );
}
