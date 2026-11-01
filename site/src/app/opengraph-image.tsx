import { ImageResponse } from "next/og";
import { figureText, rank } from "@/lib/format";
import { loadResults } from "@/lib/results";

export const dynamic = "force-static";
export const alt = "plugweight: what the most-installed Claude Code plugins add to every session";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  // Only exact figures from other people's plugins: an "at least" is too uncertain for a headline image.
  const top = rank(loadResults()).ranked.filter((e) => e.status === "ok" && !e.minimum && !e.ownProject).slice(0, 5);
  const max = Math.max(1, ...top.map((e) => e.tokens ?? 0));
  return new ImageResponse(
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#10120d", color: "#eef0e6", padding: 64, fontFamily: "sans-serif" }}>
      <div style={{ fontSize: 34, fontWeight: 700 }}>plugweight</div>
      <div style={{ fontSize: 58, fontWeight: 700, marginTop: 20, lineHeight: 1.05 }}>What Claude Code plugins add to every session</div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 44, gap: 16 }}>
        {top.map((e) => (
          <div key={e.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24 }}>
              <span>{e.name}</span>
              <span>{figureText(e)} tokens</span>
            </div>
            <div style={{ display: "flex", height: 10, width: `${((e.tokens ?? 0) / max) * 100}%`, background: "#c9f03c" }} />
          </div>
        ))}
      </div>
    </div>,
    size,
  );
}
