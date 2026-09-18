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
  const { workspace, refreshWorkspace } = useStore();
  const rows = [...(projects || []), ...(workspace.projects || [])].filter(
    (row, index, all) => row?.name?.trim() && all.findIndex((item) => item.id === row.id || item.name === row.name) === index,
  );
  const [syncing, setSyncing] = useState(false);
  const tried = useRef(false);
  const linked = Boolean(workspace.settings.buildr_linked && workspace.settings.buildr_company_id.trim());

  const pullJobs = async () => {
    setSyncing(true);
    try {
      await fetch("/api/buildr/sync", { method: "POST" });
      await refreshWorkspace();
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (tried.current || rows.length || !linked) return;
    tried.current = true;
    setSyncing(true);
    void fetch("/api/buildr/sync", { method: "POST" })
      .then(() => refreshWorkspace())
      .finally(() => setSyncing(false));
  }, [linked, refreshWorkspace, rows.length]);

  const active = rows.filter((row) => row.status !== "completed");
  const completed = rows.filter((row) => row.status === "completed");
  const known = new Set(rows.map((row) => row.name));

  return (
    <div className="space-y-2">
      <select
        className={selectClass}
        value={value}
        disabled={false}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{allowNone ? "No project" : "Select a Buildr project"}</option>
        {value && !known.has(value) ? <option value={value}>{value}</option> : null}
        {active.map((project) => (
          <option key={project.id} value={project.name}>
            {project.project_number ? `${project.project_number} · ${project.name}` : project.name}
          </option>
        ))}
        {completed.map((project) => (
          <option key={project.id} value={project.name}>
            {project.project_number ? `${project.project_number} · ${project.name}` : project.name} (completed)
          </option>
        ))}
      </select>
      <Input
        value={value}
        placeholder="Or type a job name"
        onChange={(event) => onChange(event.target.value)}
      />
      {!rows.length ? (
        <p className="text-xs text-muted-foreground">
          {syncing
            ? "Pulling jobs from Buildr…"
            : linked
              ? "No jobs in this workspace yet."
              : "Link Buildr in Settings to fill this list."}{" "}
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
      ) : null}
    </div>
  );
}
