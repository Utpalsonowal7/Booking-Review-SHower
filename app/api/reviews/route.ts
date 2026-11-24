import { NextResponse } from "next/server";
import { mergeReviews, readReviews } from "@/lib/review-store";
import { normalizeReview, sentimentOf, type Review } from "@/lib/reviews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const property = url.searchParams.get("property") || "all";
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  const sentiment = url.searchParams.get("sentiment") || "all";
  const query = (url.searchParams.get("q") || "").trim().toLowerCase();
  const rawLimit = Number(url.searchParams.get("limit") || "1000");
  const limit = Number.isFinite(rawLimit) ? Math.min(5000, Math.max(1, rawLimit)) : 1000;

  const allReviews = await readReviews();
  const reviews = allReviews
    .filter((review) => property === "all" || review.property_id === property)
    .filter((review) => !from || review.date >= from)
    .filter((review) => !to || review.date <= to)
    .filter((review) => sentiment === "all" || sentimentOf(review.rating) === sentiment)
    .filter((review) => !query || `${review.title} ${review.positive_text} ${review.negative_text} ${review.text || ""}`.toLowerCase().includes(query))
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, limit);

  const sourceMode = allReviews.length && allReviews.every((review) => review.source.toLowerCase() === "demo") ? "demo" : "authorized";
  return NextResponse.json({ reviews, total: allReviews.length, sourceMode });
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const rows = Array.isArray(payload) ? payload : payload && typeof payload === "object" ? (payload as { reviews?: unknown }).reviews : null;
  if (!Array.isArray(rows)) return NextResponse.json({ error: "Send a JSON array or an object with a reviews array." }, { status: 400 });
  if (rows.length > 5000) return NextResponse.json({ error: "A single import is limited to 5,000 rows." }, { status: 413 });
  if (!rows.length) return NextResponse.json({ error: "The import contains no review rows." }, { status: 400 });

  const normalized: Review[] = [];
  const errors: string[] = [];
  rows.forEach((row, index) => {
    try {
      normalized.push(normalizeReview(row));
    } catch (error) {
      errors.push(`Row ${index + 1}: ${error instanceof Error ? error.message : "invalid review"}`);
    }
  });
  if (!normalized.length) {
    return NextResponse.json({ error: "No valid review rows were found.", rowErrors: errors.slice(0, 20) }, { status: 400 });
  }

  const result = await mergeReviews(normalized);
  return NextResponse.json({
    ok: true,
    added: result.added,
    updated: result.updated,
    duplicates: result.duplicates,
    demoRowsRemoved: result.demoRowsRemoved,
    invalidRows: errors.length,
    rowErrors: errors.slice(0, 20),
    total: result.reviews.length,
  });
}
