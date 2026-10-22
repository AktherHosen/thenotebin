import { revalidatePath } from "next/cache";

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  revalidatePath("/", "layout");
  return Response.json({ ok: true, at: new Date().toISOString() });
}
