"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MarketingHeader } from "@/components/marketing-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"company" | "invite">("company");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        companyName: mode === "company" ? companyName : undefined,
        inviteCode: mode === "invite" ? inviteCode : undefined,
      }),
    });
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    setBusy(false);
    if (!response.ok) {
      setError(data?.error || "Could not create the account.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#0d1117]">
      <MarketingHeader />
      <div className="mx-auto max-w-md px-4 py-16">
        <Card className="border-white/10 bg-white">
          <CardHeader>
            <CardTitle>{mode === "company" ? "Create a company workspace" : "Join with an invite code"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={mode === "company" ? "default" : "outline"}
                onClick={() => setMode("company")}
              >
                New company
              </Button>
              <Button
                type="button"
                variant={mode === "invite" ? "default" : "outline"}
                onClick={() => setMode("invite")}
              >
                I have a code
              </Button>
            </div>
            <form className="space-y-4" onSubmit={submit}>
              {error ? (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="name">Your name</Label>
                <Input id="name" value={name} onChange={(event) => setName(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={6}
                  required
                />
              </div>
              {mode === "company" ? (
                <div className="space-y-2">
                  <Label htmlFor="company">Company name</Label>
                  <Input
                    id="company"
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                    placeholder="e.g. Harbor Electric"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    You start on the free Starter plan with an empty catalog. Add your own warehouses next.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="invite">Invite code</Label>
                  <Input
                    id="invite"
                    value={inviteCode}
                    onChange={(event) => setInviteCode(event.target.value)}
                    placeholder="SUMMIT-TRIAL"
                    className="font-mono uppercase"
                    required
                  />
                </div>
              )}
              <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90" disabled={busy}>
                {busy ? "Creating account…" : mode === "company" ? "Create workspace" : "Join company"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="font-medium text-primary underline">
                  Log in
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
