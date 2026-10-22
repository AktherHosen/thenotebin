"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

export async function savePost(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id") || "");
  const title = String(formData.get("title") || "").trim();
  const slug = slugify(String(formData.get("slug") || "") || title);
  const status = String(formData.get("status") || "draft");
  const publishedRaw = String(formData.get("published_at") || "");

  let published_at: string | null = publishedRaw ? new Date(publishedRaw).toISOString() : null;
  if (status === "published" && !published_at) published_at = new Date().toISOString();

  const payload = {
    title,
    slug,
    content: String(formData.get("content") || ""),
    excerpt: String(formData.get("excerpt") || "") || null,
    cover_image: String(formData.get("cover_image") || "") || null,
    status,
    published_at,
    updated_at: new Date().toISOString(),
  };

  const { error } = id
    ? await supabase.from("posts").update(payload).eq("id", id)
    : await supabase.from("posts").insert({ ...payload, author_id: user.id });

  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath(`/blog/${slug}`);
  revalidatePath("/admin");
  redirect("/admin");
}

export async function deletePost(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));

  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/admin");
}
