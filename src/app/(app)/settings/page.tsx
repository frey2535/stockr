"use client";

import { useEffect, useState } from "react";
import { Copy, ImagePlus, Link2, Settings, Shield, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getPlan } from "@/lib/plans";
import { useStore } from "@/lib/store";
import type { AccessCodeType } from "@/lib/types";

export default function SettingsPage() {
  const { state, account, updateSettings, resetDemo, createAccessCode, toggleAccessCode } = useStore();
  const { settings, accessCodes } = state;
  const [draft, setDraft] = useState(settings);
  const [label, setLabel] = useState("");
  const [codeType, setCodeType] = useState<AccessCodeType>("trial");

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const saveBranding = async () => {
    const result = await updateSettings(draft);
    if (!result.ok) {
      toast.error(result.error || "Could not save settings.");
      return;
    }
    toast.success("Branding saved");
  };

  const onLogo = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setDraft((prev) => ({ ...prev, logo_url: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
  };

  const plan = account ? getPlan(account.company.plan) : null;
  const isOwner = account?.role === "owner";
  const isDemo = account?.company.id === "co_summit";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Company branding, team, and invite codes"
        icon={<Settings className="size-8 text-secondary" />}
        actions={
          draft.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={draft.logo_url} alt="Company Logo" className="h-14 w-auto max-w-[200px] object-contain" />
          ) : null
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Workspace database</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {account?.dataBackend === "supabase" ? (
            <p>
              Company data is stored in your Supabase project as separate tables (locations,
              catalog, inventory, activity, invites). This is the production store.
            </p>
          ) : (
            <p>
              This preview is using the local SQLite file. Add{" "}
              <span className="font-mono text-foreground">NEXT_PUBLIC_SUPABASE_URL</span> and{" "}
              <span className="font-mono text-foreground">SUPABASE_SERVICE_ROLE_KEY</span>, then run{" "}
              <span className="font-mono text-foreground">supabase/schema.sql</span> in the Supabase
              SQL editor to move every company onto your hosted database.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5 text-secondary" />
            Team
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {account?.company.name} · {plan?.name} plan · {account?.members.length || 0}
            {plan?.seats != null ? ` / ${plan.seats}` : ""} seats
          </p>
          <div className="space-y-2">
            {(account?.members || []).map((member) => (
              <div key={member.id} className="flex items-center justify-between rounded-xl bg-muted/30 p-3">
                <div>
                  <p className="text-sm font-medium">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{member.email}</p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {member.role}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImagePlus className="size-5 text-secondary" />
            Company Branding
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Company Logo</Label>
            <div className="flex items-center gap-4">
              {draft.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.logo_url} alt="Logo" className="h-16 w-auto rounded-lg border bg-white object-contain p-1" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed">
                  <ImagePlus className="size-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={(event) => onLogo(event.target.files?.[0])} />
                <Button variant="outline" asChild>
                  <label htmlFor="logo-upload" className="cursor-pointer">
                    {draft.logo_url ? "Change Logo" : "Upload Logo"}
                  </label>
                </Button>
                {draft.logo_url ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setDraft({ ...draft, logo_url: "" })}
                  >
                    <Trash2 className="mr-2 size-4" />
                    Remove Logo
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Company Name</Label>
            <Input
              value={draft.company_name}
              onChange={(event) => setDraft({ ...draft, company_name: event.target.value })}
              placeholder="e.g. Acme Contracting LLC"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Primary Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={draft.primary_color}
                  onChange={(event) => setDraft({ ...draft, primary_color: event.target.value })}
                  className="size-10 cursor-pointer rounded-lg border"
                />
                <Input
                  value={draft.primary_color}
                  onChange={(event) => setDraft({ ...draft, primary_color: event.target.value })}
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Accent Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={draft.accent_color}
                  onChange={(event) => setDraft({ ...draft, accent_color: event.target.value })}
                  className="size-10 cursor-pointer rounded-lg border"
                />
                <Input
                  value={draft.accent_color}
                  onChange={(event) => setDraft({ ...draft, accent_color: event.target.value })}
                  className="font-mono text-sm"
                />
              </div>
            </div>
          </div>
          <div className="rounded-xl border p-4" style={{ backgroundColor: `${draft.primary_color}15` }}>
            <p className="mb-2 text-sm font-medium">Preview</p>
            <div className="flex items-center gap-3">
              {draft.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.logo_url} alt="Logo" className="h-8 w-auto object-contain" />
              ) : null}
              <span className="font-bold" style={{ color: draft.primary_color }}>
                {draft.company_name || "Your Company Name"}
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: draft.accent_color }}
              >
                Stockr
              </span>
            </div>
          </div>
          <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90" onClick={saveBranding}>
            Save Branding
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="size-5 text-secondary" />
            Buildr Integration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Link to Buildr App</p>
              <p className="text-sm text-muted-foreground">
                Store a Buildr company ID with this workspace
              </p>
            </div>
            <Switch
              checked={draft.buildr_linked}
              onCheckedChange={(checked) => setDraft({ ...draft, buildr_linked: checked })}
            />
          </div>
          {draft.buildr_linked ? (
            <div className="space-y-2">
              <Label>Buildr Company ID</Label>
              <Input
                value={draft.buildr_company_id}
                onChange={(event) => setDraft({ ...draft, buildr_company_id: event.target.value })}
                placeholder="Find your Company ID in Buildr → Settings → Integrations"
              />
              <p className="text-xs text-muted-foreground">
                Saved on this company workspace. Live Buildr project sync is optional.
              </p>
            </div>
          ) : null}
          <Button variant="outline" onClick={saveBranding}>
            Save integration
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-5 text-secondary" />
            Invite codes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Share a code so a teammate can create an account and join this company. Trial codes expire
            in 14 days. Seat limits are enforced when they sign up.
          </p>
          <div className="space-y-3 rounded-xl bg-muted/40 p-4">
            <p className="text-sm font-medium">Create invite</p>
            <div className="space-y-2">
              <Label>Label (e.g. contractor name)</Label>
              <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="e.g. John Smith - Trial" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={codeType === "trial" ? "default" : "outline"}
                onClick={() => setCodeType("trial")}
              >
                Trial (14 days)
              </Button>
              <Button
                variant={codeType === "permanent" ? "default" : "outline"}
                onClick={() => setCodeType("permanent")}
              >
                Permanent
              </Button>
            </div>
            <Button
              className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90"
              onClick={async () => {
                if (!label.trim()) {
                  toast.error("Add a label first.");
                  return;
                }
                const created = await createAccessCode({ label: label.trim(), type: codeType });
                if (!created.ok) {
                  toast.error(created.error);
                  return;
                }
                toast.success(`Code ${created.code.code} created`);
                setLabel("");
              }}
            >
              Generate code
            </Button>
          </div>
          <div className="space-y-2">
            {accessCodes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invite codes yet.</p>
            ) : null}
            {accessCodes.map((code) => {
              const expired = code.type === "trial" && code.expires_at && new Date(code.expires_at) < new Date();
              return (
                <div key={code.id} className="flex flex-col gap-3 rounded-xl bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-mono text-sm font-semibold">{code.code}</p>
                    <p className="text-xs text-muted-foreground">{code.label}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={!code.is_active || expired ? "bg-gray-100 text-gray-600" : "bg-green-100 text-green-700"}>
                      {!code.is_active ? "Inactive" : expired ? "Expired" : code.type}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(code.code);
                          toast.success(`Copied ${code.code}`);
                        } catch {
                          toast.error("Could not copy the code.");
                        }
                      }}
                    >
                      <Copy className="mr-1 size-3.5" />
                      Copy
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggleAccessCode(code.id)}>
                      {code.is_active ? "Revoke" : "Restore"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {isOwner ? (
        <Card>
          <CardHeader>
            <CardTitle>Workspace data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {isDemo
                ? "Reload the Summit Electric training catalog, trucks, and purchase orders."
                : "Clear inventory, catalog, and activity for this company. Branding is kept as an empty shop."}
            </p>
            <Button
              variant="outline"
              className="border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={async () => {
                const result = await resetDemo();
                if (!result.ok) {
                  toast.error(result.error || "Could not reset.");
                  return;
                }
                toast.success(isDemo ? "Training data restored" : "Workspace cleared");
              }}
            >
              {isDemo ? "Reset training data" : "Clear workspace data"}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
