import PostForm from "@/components/PostForm";

export const metadata = { title: "New post" };

export default function NewPostPage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">New post</h1>
      <PostForm />
    </div>
  );
}
