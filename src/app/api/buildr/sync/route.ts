import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth";
import { getCompanyState, setCompanyState } from "@/lib/db";
import { fetchBuildrProjects } from "@/lib/buildr";
import { applyCommand } from "@/lib/mutations";
import { getWorkspaceShell } from "@/lib/workspace-data";

export const runtime = "nodejs";

export async function POST() {
  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prev = await getCompanyState(account.company.id);
  const companyId = prev.settings.buildr_company_id;
  if (!prev.settings.buildr_linked || !companyId.trim()) {
    return NextResponse.json(
      { error: "Enter a Buildr company ID in Settings and turn the integration on." },
      { status: 400 },
    );
  }

  try {
    const remote = await fetchBuildrProjects(companyId);
    if (!remote.projects.length) {
      if (prev.projects.length) {
        return NextResponse.json({
          ok: true,
          source: "existing",
          count: prev.projects.length,
          warning: remote.error || "Buildr was unreachable; kept the projects already on this workspace.",
          workspace: await getWorkspaceShell(account.company.id),
        });
      }
      return NextResponse.json(
        {
          error: remote.error || "Buildr did not return any projects.",
          workspace: await getWorkspaceShell(account.company.id),
          projects: prev.projects,
        },
        { status: 502 },
      );
    }

    const result = applyCommand(prev, { type: "replaceProjects", projects: remote.projects }, account.user.email);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    await setCompanyState(account.company.id, result.state);

    return NextResponse.json({
      ok: true,
      source: remote.source,
      count: remote.projects.length,
      workspace: await getWorkspaceShell(account.company.id),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not reach Buildr.";
    if (prev.projects.length) {
      return NextResponse.json({
        ok: true,
        source: "existing",
        count: prev.projects.length,
        warning: message,
        workspace: await getWorkspaceShell(account.company.id),
      });
    }
    return NextResponse.json(
      {
        error: /530|ENOTFOUND|DNS/i.test(message)
          ? "Buildr DNS failed. Stockr now syncs from buildrpm.com — add BUILDR_API_KEY if projects still do not load."
          : message,
        workspace: await getWorkspaceShell(account.company.id),
        projects: prev.projects,
      },
      { status: 502 },
    );
  }
}
