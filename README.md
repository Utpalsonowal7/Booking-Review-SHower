# Azzurro Guest Pulse

A Next.js dashboard prototype for operations teams to review guest feedback across four Azzurro Hotels properties. It includes weekly rating KPIs, property scores, sentiment trends, topic signals, review search and filters, and an API-backed CSV/JSON import flow.

> **Sample data notice:** `data/reviews.json` contains 24 fictional reviews written only to demonstrate the interface. They are not Booking.com reviews and should not be used for operational decisions.

## Run locally

Requirements: Node.js 20.9 or newer and npm. The project uses the Next.js App Router and Route Handlers.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

The `Import reviews` button accepts CSV or JSON. The API validates each record, maps property aliases, removes fictional starter rows on the first successful authorized import, and upserts by source review ID. Imports write to `data/reviews.json` in the local working tree. This file-based store is for the local prototype only; serverless production deployments need shared database storage.

## Review collection and authorization

This repository does **not** scrape Booking.com or request its review pages. Booking.com’s [current customer terms](https://www.booking.com/content/terms.html) prohibit automated access, copying, or scraping without prior express written permission. The task brief says there is no Booking.com API access, so this project does not include an unapproved page scraper.

For real data, Azzurro must first confirm a permitted source and rights to store and analyze the review text. Use a source Booking.com has expressly authorized, or a review data provider whose agreement covers these properties and this use. The app’s `POST /api/reviews` route is the ingestion boundary for an authorized CSV/JSON export. No cookies, anti-bot bypasses, browser automation, or direct Booking.com fetches are used.

If a permitted feed is later provided, implement its adapter separately from the dashboard and pass normalized records to the same upsert path. A production collector should use documented rate limits, timeouts, bounded retries with backoff for temporary failures, stable source IDs, and freshness alerts. None of those network polling behaviors can be implemented until an authorized source is available.

## API

### `GET /api/reviews`

Returns review records and source mode. Optional query parameters:

- `property`: one of the property IDs below, or `all`.
- `from`, `to`: inclusive ISO dates (`YYYY-MM-DD`).
- `sentiment`: `positive`, `mixed`, or `negative`.
- `q`: search title and review text.
- `limit`: 1–5000 (default 1000).

### `POST /api/reviews`

Accepts a JSON array of reviews or `{ "reviews": [...] }`. Each row needs a property, a score from 1 to 10, and a review date. It accepts either separate `positive_text` / `negative_text` fields or one `text` field. `source_review_id` is strongly recommended for robust updates and duplicate prevention.

Example:

```json
{
  "reviews": [
    {
      "source_review_id": "source-12345",
      "property_id": "olympic-paddington",
      "rating": 8.5,
      "date": "2026-11-24",
      "title": "Example title",
      "positive_text": "What went well",
      "negative_text": "What could improve",
      "language": "English",
      "travel_type": "Couple",
      "source": "authorized-export"
    }
  ]
}
```

The route normalizes names, validates dates/scores, deduplicates repeated imports, updates changed records with the same ID, rejects demo rows, and reports invalid rows. It removes the fictional records when the first authorized import succeeds.

## Dashboard methodology

- **Weekly average:** Monday through today, compared with the previous Monday–Sunday week.
- **Sentiment:** rating 8–10 is positive, 7 is mixed, and 1–6 needs attention. This is a transparent rating bucket, not an AI interpretation of the review text.
- **Topics:** keyword rules group reviews into cleanliness, check-in, staff, noise, facilities, location, room condition, and value for money. Topics can overlap. Shares count lower-rated reviews that match each topic. The insight panel describes the most frequent match in the selected view, not a verified root cause.
- **Filters:** property, date range, sentiment, and free-text search. Property selection also scopes the charts and KPIs; date selection scopes the feed and topic summary.

## Architecture

```text
app/page.tsx                    Dashboard UI and client-side filters
app/api/reviews/route.ts        GET review data + POST authorized imports
lib/reviews.ts                  Validation, property aliases, sentiment, topics
lib/review-store.ts             Local JSON read/upsert with atomic file replacement
data/reviews.json               Fictional demo records, replaced after first import
```

The API uses Next.js App Router Route Handlers (`app/api/reviews/route.ts`) and Node.js filesystem storage. For deployment, replace `lib/review-store.ts` with a shared database such as PostgreSQL before enabling multiple instances.

## Properties

| Property | ID | Booking.com page |
| --- | --- | --- |
| Olympic Hotel Paddington | `olympic-paddington` | [Open listing](https://www.booking.com/hotel/au/olympic-paddington.html) |
| Potts Point | `potts-point` | [Open listing](https://www.booking.com/hotel/au/venus-potts-point-sydney.html) |
| Central Sydney | `central-sydney` | [Open listing](https://www.booking.com/hotel/au/venus-surry-hills.html) |
| Darling Harbour | `darling-harbour` | [Open listing](https://www.booking.com/hotel/au/chateau-de-venus.html) |

Accepted aliases include each property name and the four IDs in the table.

## Limitations

- No live Booking.com collection or real source review sample is included. Real sample data requires an authorized export or written permission for a source connector.
- Keyword rules can miss paraphrases, misunderstand context or negation, and assign more than one topic to a review. Staff should inspect the review text before acting.
- File-backed writes are local and not suitable for concurrent users or serverless deployment. There is no authentication or role-based access in this prototype.
- Before production, add access controls, shared storage, privacy/retention rules, audit logging, import monitoring, and a verified source freshness indicator.

## Sensitive information

No API keys, passwords, Booking.com cookies, or credentials are included. Do not commit credentials or raw review exports that Azzurro has not approved for storage.
