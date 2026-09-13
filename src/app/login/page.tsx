"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingHeader } from "@/components/marketing-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    params.get("error") ? "Email or password is incorrect." : "",
  );
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = (await response.json().catch(() => null)) as {
      error?: string;
      next?: string;
    } | null;
    setBusy(false);
    if (!response.ok) {
      setError(data?.error || "Could not sign in.");
      return;
    }
    const destination = data?.next || (next.startsWith("/") ? next : "/dashboard");
    router.push(destination);
    router.refresh();
  };

  return (
    <Card className="border-white/10 bg-white text-foreground">
      <CardHeader>
        <CardTitle>Log in to your company</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" action="/api/auth/login" method="post" onSubmit={submit}>
          <input type="hidden" name="next" value={next.startsWith("/") ? next : "/dashboard"} />
          {error ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@shop.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90" disabled={busy}>
            {busy ? "Signing in…" : "Log in"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Try the Summit Electric demo:{" "}
            <button
              type="button"
              className="font-medium text-primary underline"
              onClick={() => {
                setEmail("demo@stockr.app");
                setPassword("demo1234");
              }}
            >
              fill demo credentials
            </button>
          </p>
          <p className="text-center text-sm text-muted-foreground">
            New company?{" "}
            <Link href="/signup" className="font-medium text-primary underline">
              Start on Starter
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#0d1117]">
      <MarketingHeader />
      <div className="mx-auto max-w-md px-4 py-16">
        <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-white/10" />}>
          <LoginForm />
        </Suspense>
      </div>
      <MarketingFooter />
    </div>
  );
}
