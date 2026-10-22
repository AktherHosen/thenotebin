import { notFound } from "next/navigation";
import PostForm from "@/components/PostForm";
import { createClient } from "@/lib/supabase/server";
import type { Post } from "@/lib/types";

export const metadata = { title: "Edit post" };

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
    <div>
      <h1 className="mb-4 text-2xl font-bold">Edit post</h1>
      <PostForm post={data as Post} />
    </div>
  );
}
