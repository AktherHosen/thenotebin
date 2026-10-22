import Link from "next/link";
import { logout } from "@/app/login/actions";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between border-b pb-4">
        <Link href="/admin" className="text-xl font-bold">
          Admin
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" target="_blank" className="hover:underline">
            View site
          </Link>
          <Link
            href="/admin/new"
            className="rounded bg-black px-3 py-1.5 text-white hover:bg-gray-800 transition-colors"
          >
            New post
          </Link>
          <form action={logout}>
            <button className="text-gray-600 hover:text-black underline">Log out</button>
          </form>
        </nav>
      </header>
      {children}
    </div>
  );
}
