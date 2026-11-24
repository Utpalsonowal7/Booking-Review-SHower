export const PROPERTIES = [
  { id: "olympic-paddington", name: "Olympic Hotel Paddington", shortName: "Olympic Hotel", url: "https://www.booking.com/hotel/au/olympic-paddington.html" },
  { id: "potts-point", name: "Potts Point", shortName: "Potts Point", url: "https://www.booking.com/hotel/au/venus-potts-point-sydney.html" },
  { id: "central-sydney", name: "Central Sydney", shortName: "Central Sydney", url: "https://www.booking.com/hotel/au/venus-surry-hills.html" },
  { id: "darling-harbour", name: "Darling Harbour", shortName: "Darling Harbour", url: "https://www.booking.com/hotel/au/chateau-de-venus.html" },
] as const;

export type PropertyId = (typeof PROPERTIES)[number]["id"];
export type Sentiment = "positive" | "mixed" | "negative";
export type Review = {
  id: string;
  property_id: PropertyId;
  date: string;
  rating: number;
  title: string;
  positive_text: string;
  negative_text: string;
  text?: string;
  language: string;
  travel_type: string;
  topics: string[];
  source: string;
  source_url?: string;
};

const PROPERTY_ALIASES: Record<string, PropertyId> = {
  "olympic-hotel-paddington": "olympic-paddington",
  "olympic-paddington": "olympic-paddington",
  "olympic-hotel": "olympic-paddington",
  "potts-point": "potts-point",
  "venus-potts-point-sydney": "potts-point",
  "central-sydney": "central-sydney",
  "venus-surry-hills": "central-sydney",
  "surry-hills": "central-sydney",
  "darling-harbour": "darling-harbour",
  "darling-harbor": "darling-harbour",
  "chateau-de-venus": "darling-harbour",
};

export const TOPICS = [
  { name: "Cleanliness", icon: "clean" },
  { name: "Check-in", icon: "checkin" },
  { name: "Staff", icon: "staff" },
  { name: "Noise", icon: "noise" },
  { name: "Facilities", icon: "facility" },
  { name: "Location", icon: "location" },
  { name: "Room condition", icon: "room" },
  { name: "Value for money", icon: "value" },
] as const;

const TOPIC_PATTERNS: Record<string, RegExp> = {
  Cleanliness: /\b(clean|cleaner|cleanliness|spotless|tidy|dust|dirty|stain|stains|mould|mold|hygiene|housekeeping|smell|musty|bin)\b/i,
  "Check-in": /\b(check[ -]?in|arrival|arrived|reception desk|key|late arrival|waited to check)\b/i,
  Staff: /\b(staff|team|receptionist|reception|front desk|service|host|manager|rude|helpful|friendly|welcoming)\b/i,
  Noise: /\b(noise|noisy|loud|quiet|voices|hear|heard|sleep|street noise|corridor)\b/i,
  Facilities: /\b(wi[ -]?fi|internet|lift|elevator|air conditioning|air con|shower|water pressure|facilities|heating|cooling|kettle)\b/i,
  Location: /\b(location|located|walk|station|nearby|neighbourhood|neighborhood|area|transport|harbour|harbor|cafe|cafes|restaurants)\b/i,
  "Room condition": /\b(room|bed|mattress|bathroom|tap|curtain|curtains|fitting|dated|tired|worn|broken|maintenance|carpet|refresh|compact)\b/i,
  "Value for money": /\b(value|price|worth|rate|cost|expensive|cheap|overpriced)\b/i,
};

function normalizedKey(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function stableId(parts: string[]): string {
  let hash = 2166136261;
  for (const character of parts.join("|").toLowerCase()) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `import-${(hash >>> 0).toString(16)}`;
}

function dateOnly(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (!raw || Number.isNaN(parsed.valueOf())) return null;
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-${String(parsed.getUTCDate()).padStart(2, "0")}`;
}

function readField(row: Record<string, unknown>, ...names: string[]): unknown {
  const keys = Object.keys(row);
  for (const name of names) {
    if (row[name] !== undefined && String(row[name]).trim() !== "") return row[name];
    const key = keys.find((candidate) => candidate.toLowerCase().trim() === name.toLowerCase());
    if (key && row[key] !== undefined && String(row[key]).trim() !== "") return row[key];
  }
  return "";
}

export function normalizeReview(input: unknown): Review {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Each review must be an object.");
  const row = input as Record<string, unknown>;
  const propertyValue = readField(row, "property_id", "property", "property_name", "hotel");
  const propertyId = PROPERTY_ALIASES[normalizedKey(propertyValue)];
  if (!propertyId) throw new Error(`Unknown property: ${String(propertyValue || "(missing)")}`);

  const ratingRaw = String(readField(row, "rating", "score", "review_score")).trim().replace(",", ".");
  const rating = Number(ratingRaw);
  if (!Number.isFinite(rating) || rating < 1 || rating > 10) throw new Error(`Invalid rating: ${ratingRaw || "(missing)"}`);

  const date = dateOnly(readField(row, "date", "review_date", "published_at", "published_date"));
  if (!date) throw new Error("A valid review date is required.");
  const title = String(readField(row, "title", "headline", "review_title") || "Guest review").trim();
  const positiveText = String(readField(row, "positive_text", "positive", "pros")).trim();
  const negativeText = String(readField(row, "negative_text", "negative", "cons")).trim();
  const text = String(readField(row, "text", "review_text", "comment", "review")).trim();
  const rawId = String(readField(row, "id")).trim();
  const sourceId = String(readField(row, "source_review_id", "review_id")).trim();
  const recognizedId = /^(demo-|import-)/.test(rawId) || rawId.startsWith(`${propertyId}:`);
  const id = sourceId
    ? sourceId.startsWith(`${propertyId}:`) ? sourceId : `${propertyId}:${sourceId}`
    : recognizedId ? rawId
      : rawId ? `${propertyId}:${rawId}`
        : stableId([propertyId, date, String(rating), title, positiveText, negativeText, text]);

  const rawTopics = readField(row, "topics", "topic");
  const topics = Array.isArray(rawTopics)
    ? rawTopics.map((topic) => String(topic).trim()).filter(Boolean)
    : String(rawTopics || "").split(/[|,;]/).map((topic) => topic.trim()).filter(Boolean);
  const source = String(readField(row, "source", "source_name") || "authorized-import").trim();
  if (source.toLowerCase() === "demo") throw new Error("Fictional demo rows cannot be imported as live reviews.");

  const sourceUrl = String(readField(row, "source_url", "url")).trim();
  return {
    id,
    property_id: propertyId,
    date,
    rating,
    title,
    positive_text: positiveText,
    negative_text: negativeText,
    ...(text ? { text } : {}),
    language: String(readField(row, "language")).trim(),
    travel_type: String(readField(row, "travel_type", "traveller_type", "trip_type")).trim(),
    topics,
    source,
    ...(sourceUrl ? { source_url: sourceUrl } : {}),
  };
}

export function sentimentOf(rating: number): Sentiment {
  return rating >= 8 ? "positive" : rating <= 6 ? "negative" : "mixed";
}

export function topicsForReview(review: Review): string[] {
  const knownTopics = new Set<string>(TOPICS.map((topic) => topic.name));
  const declared = review.topics.filter((topic) => knownTopics.has(topic));
  if (declared.length) return declared;
  const text = `${review.title} ${review.positive_text} ${review.negative_text} ${review.text || ""}`;
  return TOPICS.filter((topic) => TOPIC_PATTERNS[topic.name].test(text)).map((topic) => topic.name);
}

export function isDemoDataset(reviews: Review[]): boolean {
  return reviews.length === 0 || reviews.every((review) => review.source.toLowerCase() === "demo");
}
