import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth";
import { getCompanyState, setCompanyState } from "@/lib/db";
import { fetchBuildrProjects } from "@/lib/buildr";
import { applyCommand } from "@/lib/mutations";
import { mergeJobLists, visibleProjects } from "@/lib/persist-state";
import { getWorkspaceShell } from "@/lib/workspace-data";
import type { Project } from "@/lib/types";

export const runtime = "nodejs";

async function payload(companyId: string, projects: Project[], extra: Record<string, unknown> = {}) {
  const workspace = await getWorkspaceShell(companyId);
  return {
    ...extra,
    count: projects.length,
    projects,
    workspace: { ...workspace, projects },
  };
}

export async function POST() {
  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prev = await getCompanyState(account.company.id);
  const existing = visibleProjects(prev.projects);
  const companyId = prev.settings.buildr_company_id;
  if (!prev.settings.buildr_linked || !companyId.trim()) {
    return NextResponse.json(
      { error: "Enter a Buildr company ID in Settings and turn the integration on.", ...await payload(account.company.id, existing) },
      { status: 400 },
    );
  }

  try {
    const remote = await fetchBuildrProjects(companyId);
    if (!remote.projects.length) {
      if (existing.length) {
        return NextResponse.json({
          ok: true,
          source: "existing",
          warning: remote.error || "Buildr was unreachable; kept the jobs already on this workspace.",
          ...await payload(account.company.id, existing),
        });
      }
      return NextResponse.json(
        {
          error: remote.error || "Buildr did not return any jobs.",
          ...await payload(account.company.id, existing),
        },
        { status: 502 },
      );
    }

    const projects = mergeJobLists(remote.projects, existing);
    const result = applyCommand(prev, { type: "replaceProjects", projects }, account.user.email);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    await setCompanyState(account.company.id, result.state);

    return NextResponse.json({
      ok: true,
      source: remote.source,
      ...await payload(account.company.id, projects),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not reach Buildr.";
    if (existing.length) {
      return NextResponse.json({
        ok: true,
        source: "existing",
        warning: message,
        ...await payload(account.company.id, existing),
      });
    }
    return NextResponse.json(
      {
        error: /530|ENOTFOUND|DNS/i.test(message)
          ? "Buildr DNS failed. Stockr now syncs from buildrpm.com — add BUILDR_API_KEY if jobs still do not load."
          : message,
        ...await payload(account.company.id, existing),
      },
      { status: 502 },
    );
  }
}
