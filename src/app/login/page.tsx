import { login } from "./actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Mail, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Admin Login | thenotebin" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-[calc(100vh-220px)] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-4 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            <span>Back to blog</span>
          </Link>
        </div>

        <Card className="border-border/80 shadow-lg">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Lock className="h-5 w-5" />
            </div>
            <CardTitle className="text-xl font-bold">Admin Login</CardTitle>
            <CardDescription className="text-xs">
              Sign in with your credentials to manage notes
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form action={login} className="flex flex-col gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Email</label>
                <div className="relative">
                  <Input
                    name="email"
                    type="email"
                    placeholder="admin@thenotebin.com"
                    required
                    className="pl-9"
                  />
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Password</label>
                <div className="relative">
                  <Input
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    required
                    className="pl-9"
                  />
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              <Button type="submit" className="mt-2 w-full font-medium">
                Sign In to Dashboard
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
