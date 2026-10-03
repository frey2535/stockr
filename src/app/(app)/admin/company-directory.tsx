"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { COMPANY_PAGE_SIZE } from "@/lib/tenants";
import type { PlatformCompany } from "@/lib/types";
import { OpenCompanyButton } from "./open-company-button";

export function CompanyDirectory() {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<PlatformCompany[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPage = (nextSubmitted: string, nextOffset: number) => {
    setLoading(true);
    setError("");
    setSubmitted(nextSubmitted);
    setOffset(nextOffset);
  };

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      q: submitted,
      limit: String(COMPANY_PAGE_SIZE),
      offset: String(offset),
    });
    fetch(`/api/admin/companies?${params}`)
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as
          | { rows?: PlatformCompany[]; total?: number; error?: string }
          | null;
        if (cancelled) return;
        if (!response.ok) {
          setError(data?.error || "Could not load companies.");
          setRows([]);
          setTotal(0);
          return;
        }
        setError("");
        setRows(data?.rows || []);
        setTotal(data?.total || 0);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load companies.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [offset, submitted]);

  const showingFrom = total === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + rows.length, total);

  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          loadPage(q.trim(), 0);
        }}
      >
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search companies"
          aria-label="Search companies"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading companies…</p> : null}
      {!loading && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {submitted ? "No companies match that search." : "No companies yet."}
        </p>
      ) : null}
      {rows.map((company) => (
        <div
          key={company.id}
          className="flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-medium">{company.name}</p>
            <p className="text-sm text-muted-foreground">
              {company.memberCount} {company.memberCount === 1 ? "seat" : "seats"} · {company.slug}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{company.plan}</Badge>
            <Badge variant="outline">{company.planStatus}</Badge>
            <OpenCompanyButton companyId={company.id} />
          </div>
        </div>
      ))}
      {total > COMPANY_PAGE_SIZE ? (
        <div className="flex items-center justify-between gap-3 pt-2">
          <p className="text-sm text-muted-foreground">
            {showingFrom}-{showingTo} of {total}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={offset === 0}
              onClick={() => loadPage(submitted, Math.max(offset - COMPANY_PAGE_SIZE, 0))}
            >
              Previous
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={offset + COMPANY_PAGE_SIZE >= total}
              onClick={() => loadPage(submitted, offset + COMPANY_PAGE_SIZE)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
