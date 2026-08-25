"use client";

import { useState } from "react";
import { ImagePlus, Link2, Settings, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/lib/store";
import type { AccessCodeType } from "@/lib/types";

export default function SettingsPage() {
  const { state, updateSettings, resetDemo, createAccessCode, toggleAccessCode } = useStore();
  const { settings, accessCodes } = state;
  const [draft, setDraft] = useState(settings);
  const [label, setLabel] = useState("");
  const [codeType, setCodeType] = useState<AccessCodeType>("trial");

  const saveBranding = () => {
    updateSettings(draft);
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

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Customize the app for your company"
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
                Connect your inventory with your Buildr projects
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
                Project names stay local in this Cursor copy. Live Buildr sync is not required to leave Base44.
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
            Access Codes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Give contractors trial or permanent access to this app.
          </p>
          <div className="space-y-3 rounded-xl bg-muted/40 p-4">
            <p className="text-sm font-medium">Create New Code</p>
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
              onClick={() => {
                if (!label.trim()) {
                  toast.error("Add a label first.");
                  return;
                }
                const created = createAccessCode({ label: label.trim(), type: codeType });
                toast.success(`Code ${created.code} created`);
                setLabel("");
              }}
            >
              Generate code
            </Button>
          </div>
          <div className="space-y-2">
            {accessCodes.map((code) => {
              const expired = code.type === "trial" && code.expires_at && new Date(code.expires_at) < new Date();
              return (
                <div key={code.id} className="flex items-center justify-between rounded-xl bg-muted/30 p-3">
                  <div>
                    <p className="font-mono text-sm font-semibold">{code.code}</p>
                    <p className="text-xs text-muted-foreground">{code.label}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={!code.is_active || expired ? "bg-gray-100 text-gray-600" : "bg-green-100 text-green-700"}>
                      {!code.is_active ? "Inactive" : expired ? "Expired" : code.type}
                    </Badge>
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

      <Card>
        <CardHeader>
          <CardTitle>Local data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Stockr now stores everything in this browser. You can leave Base44 — no Base44 login, SDK, or hosting is required.
          </p>
          <Button
            variant="outline"
            className="border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={() => {
              resetDemo();
              setDraft(state.settings);
              toast.success("Demo data restored");
              window.location.reload();
            }}
          >
            Reset demo data
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
