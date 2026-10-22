import { login } from "./actions";

export const metadata = { title: "Login" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto mt-24 max-w-sm px-4">
      <h1 className="mb-6 text-2xl font-bold">Admin login</h1>
      {error && (
        <p className="mb-4 rounded bg-red-100 p-2 text-sm text-red-700">{error}</p>
      )}
      <form action={login} className="flex flex-col gap-3">
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="rounded border p-2"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          className="rounded border p-2"
        />
        <button className="rounded bg-black p-2 text-white hover:bg-gray-800 transition-colors">
          Sign in
        </button>
      </form>
    </main>
  );
}
