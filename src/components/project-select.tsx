"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Project } from "@/lib/types";

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
  const usable = projects.filter((row) => row.status !== "completed");
  return (
    <Select value={value || "none"} onValueChange={(next) => onChange(next === "none" ? "" : next)}>
      <SelectTrigger>
        <SelectValue placeholder="Select a Buildr project" />
      </SelectTrigger>
      <SelectContent>
        {allowNone ? <SelectItem value="none">No project</SelectItem> : null}
        {usable.map((project) => (
          <SelectItem key={project.id} value={project.name}>
            {project.project_number ? `${project.project_number} · ${project.name}` : project.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
