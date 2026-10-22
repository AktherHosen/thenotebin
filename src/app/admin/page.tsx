import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { deletePost } from "./actions";
import type { Post } from "@/lib/types";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false });

  const posts = (data ?? []) as Post[];
  const now = Date.now();

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Posts</h1>
      {posts.length === 0 && (
        <p className="text-gray-500">No posts yet. Create your first one.</p>
      )}
      <ul className="divide-y border-t">
        {posts.map((post) => {
          const scheduled =
            post.status === "published" &&
            post.published_at &&
            new Date(post.published_at).getTime() > now;
          const label =
            post.status === "draft" ? "Draft" : scheduled ? "Scheduled" : "Published";

          return (
            <li key={post.id} className="flex items-center justify-between py-3">
              <div>
                <Link
                  href={`/admin/${post.id}`}
                  className="font-medium hover:underline"
                >
                  {post.title}
                </Link>
                <p className="text-xs text-gray-500">
                  {label} · {formatDate(post.published_at ?? post.created_at)}
                </p>
              </div>
              <form action={deletePost}>
                <input type="hidden" name="id" value={post.id} />
                <button className="text-sm text-red-600 hover:underline">Delete</button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
