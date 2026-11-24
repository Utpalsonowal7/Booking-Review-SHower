import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Review } from "@/lib/reviews";

const dataPath = path.join(process.cwd(), "data", "reviews.json");
let writeQueue: Promise<void> = Promise.resolve();

export async function readReviews(): Promise<Review[]> {
  try {
    const contents = await readFile(dataPath, "utf8");
    const parsed = JSON.parse(contents);
    return Array.isArray(parsed) ? parsed as Review[] : [];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

export async function mergeReviews(incoming: Review[]) {
  const operation = writeQueue.then(async () => {
    const current = await readReviews();
    const hadDemo = current.some((review) => review.source.toLowerCase() === "demo");
    const working = hadDemo ? current.filter((review) => review.source.toLowerCase() !== "demo") : current;
    const byId = new Map(working.map((review) => [review.id, review]));
    let added = 0;
    let updated = 0;
    let duplicates = 0;

    for (const review of incoming) {
      const previous = byId.get(review.id);
      if (!previous) {
        byId.set(review.id, review);
        added += 1;
      } else if (JSON.stringify(previous) !== JSON.stringify(review)) {
        byId.set(review.id, review);
        updated += 1;
      } else {
        duplicates += 1;
      }
    }

    const reviews = [...byId.values()].sort((left, right) => right.date.localeCompare(left.date) || left.id.localeCompare(right.id));
    const temporaryPath = path.join(path.dirname(dataPath), `.reviews-${randomUUID()}.tmp`);
    await writeFile(temporaryPath, `${JSON.stringify(reviews, null, 2)}\n`, "utf8");
    await rename(temporaryPath, dataPath);
    return { reviews, added, updated, duplicates, demoRowsRemoved: hadDemo ? current.length - working.length : 0 };
  });

  writeQueue = operation.then(() => undefined, () => undefined);
  return operation;
}
