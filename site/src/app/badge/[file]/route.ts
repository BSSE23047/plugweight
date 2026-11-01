import { badgeFor } from "@/lib/format";
import { loadEntry, loadResults } from "@/lib/results";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return loadResults().map((e) => ({ file: `${e.name}.json` }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const entry = loadEntry(file.replace(/\.json$/, ""));
  if (!entry) return new Response("Not found", { status: 404 });
  return Response.json(badgeFor(entry));
}
