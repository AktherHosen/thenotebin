import { notFound } from "next/navigation";
import PostForm from "@/components/PostForm";
import { createClient } from "@/lib/supabase/server";
import type { Post } from "@/lib/types";

export const metadata = { title: "Edit Note | thenotebin Admin" };

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("posts").select("*").eq("id", id).single();

  if (!data) {
    notFound();
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit Note</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Update content, metadata, or publishing status.</p>
      </div>
      <PostForm post={data as Post} />
    </div>
  );
}
