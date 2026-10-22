import PostForm from "@/components/PostForm";

export const metadata = { title: "New Note | thenotebin Admin" };

export default function NewPostPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create New Note</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Write a new technical note or draft an essay.</p>
      </div>
      <PostForm />
    </div>
  );
}
