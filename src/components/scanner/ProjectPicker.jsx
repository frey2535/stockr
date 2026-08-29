import React, { useState, useRef, useEffect } from "react";
import { X, Clock } from "lucide-react";

const LS_RECENT_PROJECTS_KEY = "stockr_recent_projects";
const MAX_RECENT_PROJECTS = 5;

function loadRecentProjectIds() {
  try { return JSON.parse(localStorage.getItem(LS_RECENT_PROJECTS_KEY)) || []; } catch { return []; }
}
function saveRecentProjectId(projectId) {
  const current = loadRecentProjectIds();
  const updated = [projectId, ...current.filter(id => id !== projectId)].slice(0, MAX_RECENT_PROJECTS);
  try { localStorage.setItem(LS_RECENT_PROJECTS_KEY, JSON.stringify(updated)); } catch {}
}

export function markProjectUsed(projectId) {
  if (projectId) saveRecentProjectId(projectId);
}

const STATUS_STYLES = {
  active: "bg-green-100 text-green-700",
  bidding: "bg-orange-100 text-orange-700",
  completed: "bg-gray-100 text-gray-500",
};

const STATUS_ORDER = { active: 0, bidding: 1, completed: 2 };

export default function ProjectPicker({ projects = [], value, onChange, placeholder = "Select project (optional)" }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const inputRef = useRef(null);

  const selected = projects.find(p => p.id === value);
  const recentIds = loadRecentProjectIds();

  const filtered = query
    ? projects.filter(p => {
        const q = query.toLowerCase();
        return (p.name || "").toLowerCase().includes(q) || (p.project_number || "").toLowerCase().includes(q);
      })
    : projects;

  const sorted = [...filtered].sort((a, b) => {
    const sa = STATUS_ORDER[a.status] ?? 3;
    const sb = STATUS_ORDER[b.status] ?? 3;
    if (sa !== sb) return sa - sb;
    return (a.name || "").localeCompare(b.name || "");
  });

  const recentProjects = !query
    ? recentIds.map(id => projects.find(p => p.id === id)).filter(Boolean)
    : [];

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const renderProjectRow = (p) => (
    <button
      key={p.id}
      type="button"
      className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center justify-between gap-2"
      onClick={() => { onChange(p.id); setOpen(false); setQuery(""); }}
    >
      <span className="flex-1 min-w-0 truncate">
        {p.project_number ? `${p.project_number} – ` : ""}{p.name}
      </span>
      {p.status && (
        <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${STATUS_STYLES[p.status] || "bg-gray-100 text-gray-500"}`}>
          {p.status}
        </span>
      )}
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <div
        className="flex h-9 w-full items-center rounded-lg border border-input bg-transparent px-3 text-sm cursor-pointer gap-2 hover:border-primary/50 transition-colors"
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
      >
        {selected ? (
          <span className="flex-1 truncate">
            {selected.project_number ? `${selected.project_number} – ` : ""}{selected.name}
          </span>
        ) : (
          <span className="flex-1 text-muted-foreground">{placeholder}</span>
        )}
        {selected && (
          <button onClick={e => { e.stopPropagation(); onChange(""); }} className="text-muted-foreground hover:text-foreground flex-shrink-0">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-popover border rounded-lg shadow-lg overflow-hidden">
          <input
            ref={inputRef}
            className="w-full px-3 py-2 text-sm border-b bg-transparent outline-none"
            placeholder="Type to filter by name or number..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          <div className="max-h-72 overflow-y-auto">
            {!query && recentProjects.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-xs text-muted-foreground flex items-center gap-1 bg-muted/30">
                  <Clock className="w-3 h-3" /> Recent
                </div>
                {recentProjects.map(renderProjectRow)}
                <div className="border-t" />
              </>
            )}
            {sorted.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">No projects found</div>
            ) : (
              sorted.map(renderProjectRow)
            )}
          </div>
        </div>
      )}
    </div>
  );
}