import Link from "next/link";
import { logout } from "@/app/login/actions";
import { buttonVariants } from "@/components/ui/button";
import { Plus, ExternalLink, LogOut, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      {/* Admin Navigation Bar */}
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <div>
            <Link href="/admin" className="text-xl font-bold tracking-tight hover:opacity-80 transition-opacity">
              Dashboard
            </Link>
            <p className="text-xs text-muted-foreground">Manage your articles and notes</p>
          </div>
        </div>

        <nav className="flex items-center gap-2">
          <Link
            href="/"
            target="_blank"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5 text-xs")}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>View site</span>
          </Link>

          <Link
            href="/admin/new"
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "gap-1.5 text-xs")}
          >
            <Plus className="h-4 w-4" />
            <span>New note</span>
          </Link>

          <form action={logout}>
            <button
              type="submit"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5 text-xs text-muted-foreground hover:text-destructive")}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Log out</span>
            </button>
          </form>
        </nav>
      </header>

      {children}
    </div>
  );
}
