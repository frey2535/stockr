import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings as SettingsIcon, Upload, Link2, Shield, Plus, Trash2, Copy, Check, Building2, UserCheck } from "lucide-react";
import { useUserCompanyId } from "@/lib/useUserCompanyId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format, isAfter } from "date-fns";

export default function Settings() {
  const queryClient = useQueryClient();
  const { activeCompanyId } = useUserCompanyId();
  const [settings, setSettings] = useState({
    company_name: "",
    logo_url: "",
    primary_color: "#1e3a5f",
    accent_color: "#f59e0b",
    buildr_linked: false,
    buildr_company_id: "",
  });
  const [settingsId, setSettingsId] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Access code state
  const [newCodeLabel, setNewCodeLabel] = useState("");
  const [newCodeType, setNewCodeType] = useState("trial");
  const [newCodeExpiry, setNewCodeExpiry] = useState("");
  const [copiedCode, setCopiedCode] = useState(null);

  const { data: settingsList = [] } = useQuery({
    queryKey: ["appSettings", activeCompanyId],
    queryFn: () => activeCompanyId ? base44.entities.AppSettings.filter({ company_id: activeCompanyId }) : Promise.resolve([]),
    enabled: !!activeCompanyId,
  });

  const { data: accessCodes = [], refetch: refetchCodes } = useQuery({
    queryKey: ["accessCodes", activeCompanyId],
    queryFn: () => activeCompanyId ? base44.entities.AccessCode.filter({ company_id: activeCompanyId }, "-created_date") : Promise.resolve([]),
    enabled: !!activeCompanyId,
  });

  useEffect(() => {
    if (settingsList.length > 0) {
      const s = settingsList[0];
      setSettingsId(s.id);
      setSettings({
        company_name: s.company_name || "",
        logo_url: s.logo_url || "",
        primary_color: s.primary_color || "#1e3a5f",
        accent_color: s.accent_color || "#f59e0b",
        buildr_linked: s.buildr_linked || false,
        buildr_company_id: s.buildr_company_id || "",
      });
    }
  }, [settingsList]);

  const saveSettings = async () => {
    setSavingSettings(true);
    if (settingsId) {
      await base44.entities.AppSettings.update(settingsId, settings);
    } else {
      const created = await base44.entities.AppSettings.create({ ...settings, company_id: activeCompanyId });
      setSettingsId(created.id);
    }
    queryClient.invalidateQueries({ queryKey: ["appSettings", activeCompanyId] });
    setSavingSettings(false);
    toast.success("Settings saved!");
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setSettings((s) => ({ ...s, logo_url: file_url }));
    setUploadingLogo(false);
    toast.success("Logo uploaded!");
  };

  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 12; i++) {
      if (i > 0 && i % 4 === 0) code += "-";
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  };

  const createAccessCode = async () => {
    if (!newCodeLabel.trim()) {
      toast.error("Please enter a label for this code");
      return;
    }
    if (newCodeType === "trial" && !newCodeExpiry) {
      toast.error("Please set an expiry date for trial codes");
      return;
    }
    const code = generateCode();
    await base44.entities.AccessCode.create({
      code,
      type: newCodeType,
      label: newCodeLabel.trim(),
      expires_at: newCodeType === "trial" ? newCodeExpiry : undefined,
      is_active: true,
      company_id: activeCompanyId,
    });
    setNewCodeLabel("");
    setNewCodeExpiry("");
    refetchCodes();
    toast.success(`Access code created: ${code}`);
  };

  const deactivateCode = async (id) => {
    await base44.entities.AccessCode.update(id, { is_active: false });
    refetchCodes();
    toast.success("Code deactivated");
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Grant Access state
  const [grantEmail, setGrantEmail] = useState("");
  const [grantCompanyId, setGrantCompanyId] = useState("");
  const [grantCompanyName, setGrantCompanyName] = useState("");
  const [grantingAccess, setGrantingAccess] = useState(false);

  const grantAccess = async () => {
    if (!grantEmail.trim() || !grantCompanyId.trim()) {
      toast.error("Email and Company ID are required");
      return;
    }
    if (!grantCompanyId.startsWith("co_")) {
      toast.error("Company ID must start with co_");
      return;
    }
    setGrantingAccess(true);
    const response = await base44.functions.invoke("grantUserAccess", {
      email: grantEmail.trim(),
      company_id: grantCompanyId.trim(),
      company_name: grantCompanyName.trim() || grantCompanyId.trim(),
    });
    setGrantingAccess(false);
    if (response.data?.success) {
      toast.success(`Access granted: ${grantEmail} → ${grantCompanyId}`);
      setGrantEmail("");
      setGrantCompanyId("");
      setGrantCompanyName("");
    } else {
      toast.error(response.data?.error || "Failed to grant access");
    }
  };

  const isExpired = (code) => {
    if (code.type !== "trial" || !code.expires_at) return false;
    return !isAfter(new Date(code.expires_at), new Date());
  };

  return (
    <div className="space-y-8 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-secondary" />
            Settings
          </h1>
          <p className="text-muted-foreground mt-1">Customize the app for your company</p>
        </div>
        {settings.logo_url && (
          <img src={settings.logo_url} alt="Company Logo" className="h-14 w-auto max-w-[200px] object-contain self-start sm:self-auto" />
        )}
      </div>

      {/* Company Branding */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-secondary" />
            Company Branding
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Logo */}
          <div className="space-y-2">
            <Label>Company Logo</Label>
            <div className="flex items-center gap-4">
              {settings.logo_url ? (
                <img src={settings.logo_url} alt="Logo" className="h-16 w-auto rounded-lg border object-contain bg-white p-1" />
              ) : (
                <div className="h-16 w-16 rounded-lg border-2 border-dashed border-muted flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <input type="file" accept="image/*" className="hidden" id="logo-upload" onChange={handleLogoUpload} />
                <Button variant="outline" asChild disabled={uploadingLogo}>
                  <label htmlFor="logo-upload" className="cursor-pointer">
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadingLogo ? "Uploading..." : settings.logo_url ? "Change Logo" : "Upload Logo"}
                  </label>
                </Button>
                {settings.logo_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => setSettings((s) => ({ ...s, logo_url: "" }))}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove Logo
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Company Name</Label>
            <Input
              value={settings.company_name}
              onChange={(e) => setSettings((s) => ({ ...s, company_name: e.target.value }))}
              placeholder="e.g. Acme Contracting LLC"
            />
          </div>

          {/* Colors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Primary Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.primary_color}
                  onChange={(e) => setSettings((s) => ({ ...s, primary_color: e.target.value }))}
                  className="w-10 h-10 rounded-lg border cursor-pointer"
                />
                <Input
                  value={settings.primary_color}
                  onChange={(e) => setSettings((s) => ({ ...s, primary_color: e.target.value }))}
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Accent Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.accent_color}
                  onChange={(e) => setSettings((s) => ({ ...s, accent_color: e.target.value }))}
                  className="w-10 h-10 rounded-lg border cursor-pointer"
                />
                <Input
                  value={settings.accent_color}
                  onChange={(e) => setSettings((s) => ({ ...s, accent_color: e.target.value }))}
                  className="font-mono text-sm"
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-xl p-4 border" style={{ backgroundColor: settings.primary_color + "15" }}>
            <p className="text-sm font-medium mb-2">Preview</p>
            <div className="flex items-center gap-3">
              {settings.logo_url && (
                <img src={settings.logo_url} alt="Logo" className="h-8 w-auto object-contain" />
              )}
              <span className="font-bold" style={{ color: settings.primary_color }}>
                {settings.company_name || "Your Company Name"}
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs text-white font-medium" style={{ backgroundColor: settings.accent_color }}>
                Stockr
              </span>
            </div>
          </div>

          <Button onClick={saveSettings} disabled={savingSettings} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90">
            {savingSettings ? "Saving..." : "Save Branding"}
          </Button>
        </CardContent>
      </Card>

      {/* Buildr Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-secondary" />
            Buildr Integration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Link to Buildr App</p>
              <p className="text-sm text-muted-foreground">Connect your inventory with your Buildr projects</p>
            </div>
            <Switch
              checked={settings.buildr_linked}
              onCheckedChange={(val) => setSettings((s) => ({ ...s, buildr_linked: val }))}
            />
          </div>
          {settings.buildr_linked && (
            <div className="space-y-2">
              <Label>Buildr Company ID</Label>
              <Input
                value={settings.buildr_company_id}
                onChange={(e) => setSettings((s) => ({ ...s, buildr_company_id: e.target.value }))}
                placeholder="Enter your Buildr company ID"
              />
              <p className="text-xs text-muted-foreground">Find your Company ID in Buildr → Settings → Integrations</p>
            </div>
          )}
          <Button onClick={saveSettings} disabled={savingSettings} variant="outline" className="w-full">
            {savingSettings ? "Saving..." : "Save Integration Settings"}
          </Button>
        </CardContent>
      </Card>

      {/* Grant User Access */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-secondary" />
            Grant User Access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Grant an existing user access to a company. This sets their company ID and registers the company if needed.
          </p>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>User Email</Label>
              <Input
                value={grantEmail}
                onChange={(e) => setGrantEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Company ID</Label>
              <Input
                value={grantCompanyId}
                onChange={(e) => setGrantCompanyId(e.target.value)}
                placeholder="co_companyname"
              />
              <p className="text-xs text-muted-foreground">Must start with co_ (e.g. co_dayoneelectric)</p>
            </div>
            <div className="space-y-2">
              <Label>Company Name (optional)</Label>
              <Input
                value={grantCompanyName}
                onChange={(e) => setGrantCompanyName(e.target.value)}
                placeholder="e.g. Day One Electric"
              />
            </div>
            <Button
              onClick={grantAccess}
              disabled={grantingAccess}
              className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90"
            >
              <UserCheck className="w-4 h-4 mr-2" />
              {grantingAccess ? "Granting Access..." : "Grant Access"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Access Codes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-secondary" />
            Access Codes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Generate codes to grant contractors trial or permanent access to this app.
          </p>

          {/* Create new code */}
          <div className="bg-muted/40 rounded-xl p-4 space-y-3">
            <p className="font-medium text-sm">Create New Code</p>
            <div className="space-y-2">
              <Label>Label (e.g. contractor name)</Label>
              <Input
                value={newCodeLabel}
                onChange={(e) => setNewCodeLabel(e.target.value)}
                placeholder="e.g. John Smith - Trial"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Access Type</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={newCodeType === "trial" ? "default" : "outline"}
                    onClick={() => setNewCodeType("trial")}
                    className={newCodeType === "trial" ? "bg-secondary text-secondary-foreground" : ""}
                  >
                    Trial
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={newCodeType === "permanent" ? "default" : "outline"}
                    onClick={() => setNewCodeType("permanent")}
                    className={newCodeType === "permanent" ? "bg-primary text-primary-foreground" : ""}
                  >
                    Permanent
                  </Button>
                </div>
              </div>
              {newCodeType === "trial" && (
                <div className="space-y-2">
                  <Label>Expires On</Label>
                  <Input
                    type="date"
                    value={newCodeExpiry}
                    onChange={(e) => setNewCodeExpiry(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
              )}
            </div>
            <Button onClick={createAccessCode} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90">
              <Plus className="w-4 h-4 mr-2" />
              Generate Code
            </Button>
          </div>

          {/* Existing codes */}
          {accessCodes.length > 0 && (
            <div className="space-y-2">
              <Separator />
              <p className="font-medium text-sm pt-1">Issued Codes ({accessCodes.length})</p>
              <div className="space-y-2">
                {accessCodes.map((ac) => {
                  const expired = isExpired(ac);
                  const status = !ac.is_active ? "revoked" : expired ? "expired" : ac.used_by ? "used" : "active";
                  const statusColors = {
                    active: "bg-green-100 text-green-700",
                    used: "bg-blue-100 text-blue-700",
                    expired: "bg-orange-100 text-orange-700",
                    revoked: "bg-red-100 text-red-700",
                  };
                  return (
                    <div key={ac.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-sm tracking-wider">{ac.code}</span>
                          <Badge className={statusColors[status]}>{status}</Badge>
                          <Badge variant="outline" className="text-xs">{ac.type}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {ac.label}
                          {ac.expires_at && ` · Expires ${format(new Date(ac.expires_at), "MMM d, yyyy")}`}
                          {ac.used_by && ` · Used by ${ac.used_by}`}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => copyCode(ac.code)}
                        >
                          {copiedCode === ac.code ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                        {ac.is_active && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => deactivateCode(ac.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}