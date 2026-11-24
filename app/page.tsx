"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { PROPERTIES, TOPICS, sentimentOf, topicsForReview, type Review, type Sentiment } from "@/lib/reviews";

type DateRange = "all" | "week" | "lastWeek" | "30days";
type ApiResponse = { reviews: Review[]; total: number; sourceMode: "demo" | "authorized" };

function localIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function weekBounds(reference = new Date()) {
  const start = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const previousStart = new Date(start);
  previousStart.setDate(previousStart.getDate() - 7);
  const previousEnd = new Date(start);
  previousEnd.setDate(previousEnd.getDate() - 1);
  return { start: localIso(start), today: localIso(reference), previousStart: localIso(previousStart), previousEnd: localIso(previousEnd) };
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function round(value: number | null) {
  return value == null || !Number.isFinite(value) ? "—" : value.toFixed(1);
}

function average(reviews: Review[]) {
  return reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : null;
}

function dateRangeMatch(review: Review, range: DateRange, bounds: ReturnType<typeof weekBounds>, now: Date) {
  if (range === "week") return review.date >= bounds.start && review.date <= bounds.today;
  if (range === "lastWeek") return review.date >= bounds.previousStart && review.date <= bounds.previousEnd;
  if (range === "30days") {
    const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    cutoff.setDate(cutoff.getDate() - 29);
    return review.date >= localIso(cutoff) && review.date <= bounds.today;
  }
  return true;
}

function delta(current: number | null, previous: number | null) {
  if (current == null || previous == null) return { value: "—", tone: "neutral" };
  const difference = Number((current - previous).toFixed(1));
  return { value: `${difference > 0 ? "+" : ""}${difference}`, tone: difference > 0 ? "up" : difference < 0 ? "down" : "neutral" };
}

function Icon({ name, className = "" }: { name: string; className?: string }) {
  const common = { className, viewBox: "0 0 24 24", "aria-hidden": true as const };
  switch (name) {
    case "overview": return <svg {...common}><rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="4" rx="1.6"/><rect x="13.5" y="10.5" width="7" height="10" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/></svg>;
    case "reviews": return <svg {...common}><path d="M20.3 11.7a8.3 8.3 0 0 1-8.3 8.3 8.7 8.7 0 0 1-3.6-.8L4 20l.8-4.1A8.3 8.3 0 1 1 20.3 11.7Z"/><path d="M8 11.8h.01M12 11.8h.01M16 11.8h.01"/></svg>;
    case "insights": return <svg {...common}><path d="m12 3.5 2.2 5.5 5.8.5-4.4 3.7 1.4 5.6-5-3-5 3 1.4-5.6L4 9.5 9.8 9 12 3.5Z"/><path d="M19.5 3.5v3M21 5h-3"/></svg>;
    case "property": return <svg {...common}><path d="M4 20V8l8-4 8 4v12M8 20v-6h8v6M4 9h16"/></svg>;
    case "upload": return <svg {...common}><path d="M12 15V4M8 8l4-4 4 4M5 14v5h14v-5"/></svg>;
    case "search": return <svg {...common}><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg>;
    case "calendar": return <svg {...common}><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M7.5 3v4M16.5 3v4M4 9h16"/></svg>;
    case "filter": return <svg {...common}><path d="M4 6h16M7 12h10m-7 6h4"/></svg>;
    case "star": return <svg {...common}><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg>;
    case "warning": return <svg {...common}><path d="m12 3 9 16H3l9-16Z"/><path d="M12 9v4.5M12 16.5h.01"/></svg>;
    case "shield": return <svg {...common}><path d="M12 3.5 20 7v5.2c0 4.2-2.8 7.4-8 9.3-5.2-1.9-8-5.1-8-9.3V7l8-3.5Z"/><path d="m9 12 2 2 4-4"/></svg>;
    case "trend": return <svg {...common}><path d="m5 15 5-5 4 3 5-6M15 7h4v4"/></svg>;
    case "help": return <svg {...common}><circle cx="12" cy="12" r="8.5"/><path d="M9.8 9a2.3 2.3 0 1 1 3.8 1.7c-1 .9-1.6 1.2-1.6 2.5M12 16.8h.01"/></svg>;
    case "clean": return <svg {...common}><path d="M4 20h16M6 17h12l-1-9H7l-1 9ZM9 8V5a3 3 0 0 1 6 0v3M9 12h.01M15 12h.01"/></svg>;
    case "checkin": return <svg {...common}><path d="M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5M10 16l4-4-4-4M14 12H3"/></svg>;
    case "staff": return <svg {...common}><path d="M16 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-3A4.5 4.5 0 0 0 4 18.5V20M10 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM16 4.2a3.5 3.5 0 0 1 0 6.6M17 14h1a4 4 0 0 1 3 2.5V20"/></svg>;
    case "noise": return <svg {...common}><path d="M3 10v4h4l5 4V6l-5 4H3ZM16 9a4 4 0 0 1 0 6M18.5 6a8 8 0 0 1 0 12"/></svg>;
    case "facility": return <svg {...common}><path d="M5 20V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14M3 20h18M9 8h6M9 12h6M10 20v-4h4v4"/></svg>;
    case "location": return <svg {...common}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>;
    case "room": return <svg {...common}><path d="M4 19V8l8-4 8 4v11M4 11h16M8 15h.01M16 15h.01M10 19v-4h4v4"/></svg>;
    case "value": return <svg {...common}><path d="M12 3v18M17 7.5c0-1.4-1.9-2.5-4.5-2.5S8 6.1 8 7.5 9.9 10 12.5 10s4.5 1.1 4.5 2.5-1.9 2.5-4.5 2.5S8 13.9 8 12.5"/></svg>;
    default: return <svg {...common}><circle cx="12" cy="12" r="8"/></svg>;
  }
}

function parseCsv(content: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (quoted) {
      if (character === '"' && content[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += character;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  const headers = (rows.shift() || []).map((header) => header.trim().replace(/^\uFEFF/, ""));
  return rows.filter((values) => values.some((value) => value.trim())).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
}

export default function DashboardPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [sourceMode, setSourceMode] = useState<"demo" | "authorized">("demo");
  const [selectedProperty, setSelectedProperty] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>("week");
  const [selectedSentiment, setSelectedSentiment] = useState<"all" | Sentiment>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/reviews?limit=5000", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load the review dataset.");
      const result = await response.json() as ApiResponse;
      setReviews(result.reviews);
      setSourceMode(result.sourceMode);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not load reviews.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadReviews(); }, [loadReviews]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const now = new Date();
  const bounds = useMemo(() => weekBounds(now), [now.getDate(), now.getMonth(), now.getFullYear()]);
  const thisWeek = useMemo(() => reviews.filter((review) => review.date >= bounds.start && review.date <= bounds.today && (selectedProperty === "all" || review.property_id === selectedProperty)), [reviews, bounds.start, bounds.today, selectedProperty]);
  const previousWeek = useMemo(() => reviews.filter((review) => review.date >= bounds.previousStart && review.date <= bounds.previousEnd && (selectedProperty === "all" || review.property_id === selectedProperty)), [reviews, bounds.previousStart, bounds.previousEnd, selectedProperty]);
  const thisWeekAverage = average(thisWeek);
  const lastWeekAverage = average(previousWeek);
  const ratingChange = delta(thisWeekAverage, lastWeekAverage);
  const positiveReviews = thisWeek.filter((review) => sentimentOf(review.rating) === "positive");
  const negativeReviews = thisWeek.filter((review) => sentimentOf(review.rating) === "negative");
  const positiveRate = thisWeek.length ? Math.round(positiveReviews.length / thisWeek.length * 100) : 0;
  const negativeRate = thisWeek.length ? Math.round(negativeReviews.length / thisWeek.length * 100) : 0;
  const volumeChange = previousWeek.length ? Math.round((thisWeek.length - previousWeek.length) / previousWeek.length * 100) : null;

  const filteredForInsights = useMemo(() => reviews.filter((review) =>
    (selectedProperty === "all" || review.property_id === selectedProperty) && dateRangeMatch(review, dateRange, bounds, now)
  ), [reviews, selectedProperty, dateRange, bounds.start, bounds.today, bounds.previousStart, bounds.previousEnd]);

  const visibleReviews = useMemo(() => reviews
    .filter((review) => selectedProperty === "all" || review.property_id === selectedProperty)
    .filter((review) => dateRangeMatch(review, dateRange, bounds, now))
    .filter((review) => selectedSentiment === "all" || sentimentOf(review.rating) === selectedSentiment)
    .filter((review) => !search || `${review.title} ${review.positive_text} ${review.negative_text} ${review.text || ""}`.toLowerCase().includes(search.toLowerCase()))
    .sort((left, right) => right.date.localeCompare(left.date) || left.id.localeCompare(right.id)),
  [reviews, selectedProperty, dateRange, selectedSentiment, search, bounds.start, bounds.today, bounds.previousStart, bounds.previousEnd]);

  const propertyAverages = PROPERTIES
    .filter((property) => selectedProperty === "all" || property.id === selectedProperty)
    .map((property) => {
      const items = thisWeek.filter((review) => review.property_id === property.id);
      return { property, score: average(items), count: items.length };
    });

  const insightNegatives = filteredForInsights.filter((review) => sentimentOf(review.rating) === "negative");
  const topicStats = TOPICS.map((topic) => ({
    ...topic,
    count: insightNegatives.filter((review) => topicsForReview(review).includes(topic.name)).length,
  })).sort((left, right) => right.count - left.count);
  const leadingTopic = topicStats[0];
  const leadingTopicShare = insightNegatives.length && leadingTopic?.count ? Math.round(leadingTopic.count / insightNegatives.length * 100) : 0;

  const lastFourteenDays = Array.from({ length: 14 }, (_, index) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    day.setDate(day.getDate() - (13 - index));
    const iso = localIso(day);
    const dayReviews = reviews.filter((review) => review.date === iso && (selectedProperty === "all" || review.property_id === selectedProperty));
    return {
      date: day,
      positive: dayReviews.filter((review) => sentimentOf(review.rating) === "positive").length,
      negative: dayReviews.filter((review) => sentimentOf(review.rating) === "negative").length,
    };
  });
  const maxTrend = Math.max(2, ...lastFourteenDays.map((day) => Math.max(day.positive, day.negative)));
  const firstWeekPositive = lastFourteenDays.slice(0, 7).reduce((sum, day) => sum + day.positive, 0);
  const secondWeekPositive = lastFourteenDays.slice(7).reduce((sum, day) => sum + day.positive, 0);
  const firstWeekNegative = lastFourteenDays.slice(0, 7).reduce((sum, day) => sum + day.negative, 0);
  const secondWeekNegative = lastFourteenDays.slice(7).reduce((sum, day) => sum + day.negative, 0);
  const positiveWord = secondWeekPositive > firstWeekPositive ? "more" : secondWeekPositive < firstWeekPositive ? "fewer" : "the same number of";
  const negativeWord = secondWeekNegative > firstWeekNegative ? "more" : secondWeekNegative < firstWeekNegative ? "fewer" : "the same number of";
  const chartHasReviews = lastFourteenDays.some((day) => day.positive + day.negative > 0);

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const contents = await file.text();
      const rows: unknown = file.name.toLowerCase().endsWith(".csv") ? parseCsv(contents) : JSON.parse(contents);
      if (!Array.isArray(rows)) throw new Error("JSON import must be an array of review objects.");
      const response = await fetch("/api/reviews", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reviews: rows }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Import failed.");
      await loadReviews();
      setDateRange("all");
      setSelectedSentiment("all");
      setSearch("");
      setToast(`${result.added} added · ${result.updated} updated · ${result.duplicates} duplicates skipped${result.demoRowsRemoved ? ` · ${result.demoRowsRemoved} demo rows removed` : ""}${result.invalidRows ? ` · ${result.invalidRows} invalid rows skipped` : ""}.`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "The selected file could not be imported.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <a className="brand" href="#overview" aria-label="Azzurro Hotels dashboard home">
          <span className="brand-mark"><span/><span/><span/></span>
          <span className="brand-name">azzurro<span>hotels</span></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav">
          <a className="nav-link active" href="#overview" aria-current="page"><Icon name="overview"/><span>Overview</span></a>
          <a className="nav-link" href="#reviews"><Icon name="reviews"/><span>Guest reviews</span><span className="nav-count">{thisWeek.length}</span></a>
          <a className="nav-link" href="#insights"><Icon name="insights"/><span>Topics & insights</span></a>
        </nav>
        <div className="sidebar-spacer"/>
        <div className="sidebar-note"><div className="note-icon"><Icon name="shield"/></div><strong>Reviews are guest voices.</strong><p>Read the detail behind every score before deciding what to change.</p></div>
        <div className="sidebar-footer"><span className="avatar">AS</span><span className="profile-copy"><strong>Operations team</strong><small>All properties</small></span><svg className="dots" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg></div>
      </aside>

      <main className="main-content" id="overview">
        <header className="topbar"><div className="crumb"><span>Workspace</span><span className="crumb-sep">/</span><strong>Guest pulse</strong></div><div className="top-actions"><span className={`demo-pill ${sourceMode === "authorized" ? "authorized-pill" : ""}`}><span className="demo-dot"/>{sourceMode === "demo" ? "DEMO DATA" : "AUTHORIZED DATA"}</span><button className="icon-button" aria-label="About this dashboard" title="About this dashboard" onClick={() => setShowHelp(true)}><Icon name="help"/></button><button className="avatar avatar-small" aria-label="Operations team">AS</button></div></header>

        <div className="content-wrap">
          <section className="page-heading">
            <div><div className="eyebrow"><span className="live-dot"/>PROPERTY EXPERIENCE <span className="eyebrow-divider">·</span> SYDNEY & PADDINGTON</div><h1>Guest pulse<span className="heading-period">.</span></h1><p className="heading-subtitle">A clear view of what guests are saying, and where your team can make a difference.</p></div>
            <div className="heading-actions"><label className="select-wrap" aria-label="Filter by property"><Icon name="property"/><select value={selectedProperty} onChange={(event) => setSelectedProperty(event.target.value)}><option value="all">All properties</option>{PROPERTIES.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select><svg className="select-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></label><label className={`button button-dark ${busy ? "disabled" : ""}`}><Icon name="upload"/>{busy ? "Importing…" : "Import reviews"}<input type="file" accept=".csv,.json,text/csv,application/json" onChange={importFile} disabled={busy} hidden/></label></div>
          </section>

          {sourceMode === "demo" && <section className="demo-banner" role="note"><div className="banner-icon"><Icon name="warning"/></div><div><strong>Fictional sample data</strong><span>24 invented reviews for UI demonstration. No Booking.com review text has been collected. Import only data you are authorized to use.</span></div></section>}

          <section className="kpi-grid" aria-label="Weekly overview">
            <article className="kpi-card kpi-primary"><div className="kpi-top"><span>Average guest rating</span><span className="kpi-icon mint"><Icon name="star"/></span></div><div className="kpi-value-row"><strong className="kpi-value">{round(thisWeekAverage)}</strong><span className="kpi-unit">/ 10</span><span className={`trend-chip ${ratingChange.tone}`}>{ratingChange.value} pts</span></div><div className="kpi-foot"><span>This week</span><span>vs previous week {round(lastWeekAverage)}</span></div><div className="kpi-spark" aria-hidden="true"><svg viewBox="0 0 280 44" preserveAspectRatio="none"><path className="spark-fill" d="M0 36 C18 31 25 35 42 25 S69 29 88 20 S119 25 138 17 S165 21 183 13 S213 17 232 9 S260 15 280 3 V44 H0Z"/><path className="spark-line" d="M0 36 C18 31 25 35 42 25 S69 29 88 20 S119 25 138 17 S165 21 183 13 S213 17 232 9 S260 15 280 3"/></svg></div></article>
            <article className="kpi-card"><div className="kpi-top"><span>Reviews this week</span><span className="kpi-icon lavender"><Icon name="reviews"/></span></div><div className="kpi-value-row"><strong className="kpi-value">{thisWeek.length}</strong><span className="trend-chip neutral">{volumeChange == null ? "new" : `${volumeChange > 0 ? "+" : ""}${volumeChange}%`}</span></div><div className="kpi-foot"><span>Guest voices received</span><span>vs previous week {previousWeek.length}</span></div><div className="mini-bars" aria-hidden="true">{lastFourteenDays.slice(-12).map((day, index) => <i key={index} style={{ height: `${Math.max(14, Math.min(100, (day.positive + day.negative) * 42))}%` }}/>)}</div></article>
            <article className="kpi-card"><div className="kpi-top"><span>Positive sentiment</span><span className="kpi-icon green"><Icon name="reviews"/></span></div><div className="kpi-value-row"><strong className="kpi-value">{positiveRate}%</strong><span className="kpi-unit">of reviews</span></div><div className="kpi-foot"><span>Rating 8 or higher</span><span>{positiveReviews.length} of {thisWeek.length} reviews</span></div><div className="sentiment-track"><span style={{ width: `${positiveRate}%` }}/></div></article>
            <article className="kpi-card"><div className="kpi-top"><span>Needs attention</span><span className="kpi-icon peach"><Icon name="warning"/></span></div><div className="kpi-value-row"><strong className="kpi-value">{negativeReviews.length}</strong><span className="kpi-unit">reviews</span><span className="tiny-alert">{negativeRate}%</span></div><div className="kpi-foot"><span>Rating 6 or lower</span><span>Review for follow-up</span></div><div className="attention-indicator">{[0, 1, 2, 3, 4].map((segment) => <span key={segment} className={segment < Math.ceil(negativeRate / 20) ? "on" : ""}/>)}<b>{negativeRate >= 50 ? "High attention" : negativeRate >= 25 ? "Review themes" : "Low volume"}</b></div></article>
          </section>

          <section className="overview-grid">
            <article className="panel property-panel"><div className="panel-heading"><div><div className="panel-kicker">WHERE WE STAND</div><h2>Property ratings</h2><p>Average guest score this week</p></div><button className="more-button" aria-label="Property rating details" title="Compared over this calendar week"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg></button></div><div className="property-list">{propertyAverages.map(({ property, score, count }) => <div className={`property-row ${score != null && score < 7 ? "low" : ""}`} key={property.id}><div><div className="property-meta"><a href={property.url} target="_blank" rel="noreferrer"><strong title={property.name}>{property.name}</strong></a><span>{count} {count === 1 ? "review" : "reviews"}</span></div><div className="property-track"><i style={{ width: `${score == null ? 0 : Math.min(100, score * 10)}%` }}/></div></div><div className="property-score">{round(score)}</div></div>)}</div><div className="panel-footer"><span className="legend-dot"/>Booking.com rating scale <b>0–10</b><span className="footer-caption">This week</span></div></article>
            <article className="panel trend-panel"><div className="panel-heading trend-heading"><div><div className="panel-kicker">GUEST MOOD</div><h2>Positive & negative trends</h2><p>Reviews over the last 14 days</p></div><div className="chart-legend"><span><i className="legend-positive"/>Positive</span><span><i className="legend-negative"/>Negative</span></div></div><div className="chart-wrap" role="img" aria-label="Positive and negative review counts for the past 14 days"><svg viewBox="0 0 660 178" preserveAspectRatio="none" aria-hidden="true">{[0, .5, 1].map((ratio) => { const y = 8 + 146 * (1 - ratio); return <g key={ratio}><line className="chart-grid-line" x1="26" y1={y} x2="658" y2={y}/><text className="chart-axis-label" x="0" y={y + 3}>{Math.round(maxTrend * ratio)}</text></g>; })}{lastFourteenDays.map((day, index) => { const step = 632 / 14; const center = 26 + step * index + step / 2; const barWidth = 8; const posHeight = day.positive / maxTrend * 146; const negHeight = day.negative / maxTrend * 146; const label = day.date.toLocaleDateString("en-AU", { day: "numeric", month: "short" }); return <g key={localIso(day.date)}><title>{label}: {day.positive} positive, {day.negative} negative</title><rect className="bar-positive" x={center - barWidth - 1} y={154 - posHeight} width={barWidth} height={posHeight} rx="3"/><rect className="bar-negative" x={center + 1} y={154 - negHeight} width={barWidth} height={negHeight} rx="3"/>{(index % 2 === 0 || index === 13) && <text className="chart-axis-label" x={center} y="173" textAnchor="middle">{day.date.getDate()}</text>}</g>; })}</svg></div><div className="trend-summary"><span className="trend-summary-icon"><Icon name="trend"/></span><span>{chartHasReviews ? `The latest 7 days had ${positiveWord} positive reviews and ${negativeWord} negative reviews than the 7 days before.` : "Not enough review volume yet to show a directional trend."}</span></div></article>
          </section>

          <section className="insights-section" id="insights"><div className="section-heading"><div><div className="panel-kicker">WHAT GUESTS ARE TALKING ABOUT</div><h2>Operational topics</h2><p>Common themes in lower-rated reviews</p></div><span className="method-tag"><Icon name="insights"/>Keyword-based · indicative only</span></div><div className="insight-highlight"><span className="insight-star">✳</span>{leadingTopic?.count ? <span><strong>{leadingTopicShare}% of lower-rated reviews</strong> in this view mention {leadingTopic.name.toLowerCase()} ({leadingTopic.count} of {insightNegatives.length}). Treat this as a prompt to read the reviews, not a confirmed root cause.</span> : <span>No lower-rated reviews in this view yet. The topic signal will appear as reviews are added.</span>}</div><div className="topic-grid">{TOPICS.map((topic) => { const stats = topicStats.find((item) => item.name === topic.name); const count = stats?.count || 0; const share = insightNegatives.length ? Math.round(count / insightNegatives.length * 100) : 0; return <article className={`topic-card ${leadingTopic?.count && count === leadingTopic.count ? "attention" : ""}`} key={topic.name}><div className="topic-top"><span className="topic-name">{topic.name}</span><span className="topic-icon"><Icon name={topic.icon}/></span></div><div><strong className="topic-count">{count}</strong><span className="topic-foot">{share}% of low scores</span></div><div className="topic-progress"><i style={{ width: `${Math.max(count ? 9 : 0, leadingTopic?.count ? count / leadingTopic.count * 100 : 0)}%` }}/></div></article>; })}</div></section>

          <section className="reviews-section" id="reviews"><div className="section-heading reviews-heading"><div><div className="panel-kicker">THE GUEST VOICE</div><h2>Recent reviews <span className="review-total">{visibleReviews.length}</span></h2><p>Read the context behind the score</p></div><div className="review-controls"><label className="search-field"><Icon name="search"/><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reviews" aria-label="Search reviews"/></label><label className="select-wrap filter-select" aria-label="Filter by date"><Icon name="calendar"/><select value={dateRange} onChange={(event) => setDateRange(event.target.value as DateRange)}><option value="all">All time</option><option value="week">This week</option><option value="lastWeek">Last week</option><option value="30days">Last 30 days</option></select><svg className="select-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></label><label className="select-wrap filter-select sentiment-select" aria-label="Filter by sentiment"><Icon name="filter"/><select value={selectedSentiment} onChange={(event) => setSelectedSentiment(event.target.value as "all" | Sentiment)}><option value="all">All sentiment</option><option value="positive">Positive</option><option value="mixed">Mixed</option><option value="negative">Needs attention</option></select><svg className="select-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></label></div></div>
            <div className="review-feed">{visibleReviews.map((review) => { const property = PROPERTIES.find((item) => item.id === review.property_id); const sentiment = sentimentOf(review.rating); const sentimentLabel = sentiment === "positive" ? "Positive" : sentiment === "negative" ? "Needs attention" : "Mixed"; const tags = topicsForReview(review).slice(0, 4); return <article className="review-card" key={review.id}><div className="review-main"><div className={`review-score ${sentiment === "negative" ? "low" : sentiment === "mixed" ? "mid" : ""}`}>{review.rating.toFixed(1)}<span>out of 10</span></div><div className="review-content"><div className="review-meta"><strong className="review-property">{property?.name || review.property_id}</strong><span className="review-separator">·</span><span className="review-date">{formatDate(review.date)}</span>{review.travel_type && <><span className="review-separator">·</span><span className="review-trip">{review.travel_type} stay</span></>}</div><h3 className="review-title">{review.title || "Guest review"}</h3>{review.positive_text && <p className="review-text"><strong>What went well:</strong> {review.positive_text}</p>}{review.negative_text && <p className="review-text"><strong>Could improve:</strong> {review.negative_text}</p>}{!review.positive_text && !review.negative_text && <p className="review-text">{review.text || "No review text provided."}</p>}<div className="review-tags">{tags.map((topic) => <span className={`review-tag ${sentiment === "negative" ? "negative" : ""}`} key={topic}>{topic}</span>)}</div></div></div><div className="review-footer"><span className={`review-sentiment ${sentiment}`}>{sentimentLabel}</span><span className="source-label">{review.source.toLowerCase() === "demo" ? "FICTIONAL DEMO REVIEW" : "AUTHORIZED IMPORT"}</span></div></article>; })}</div>
            {!loading && visibleReviews.length === 0 && <div className="empty-state"><div className="empty-illustration"><Icon name="reviews"/></div><strong>No reviews match these filters</strong><span>Try a wider date range or clear your search.</span><button className="button button-light" onClick={() => { setSelectedProperty("all"); setDateRange("all"); setSelectedSentiment("all"); setSearch(""); }}>Clear filters</button></div>}
            {loading ? <div className="loading-state">Loading review data…</div> : visibleReviews.length > 0 && <div className="feed-end">You’re all caught up <span>✦</span></div>}
          </section>
          <footer className="page-footer"><span>Guest pulse <i>·</i> Operations overview</span><span>{loading ? "Loading data" : `${reviews.length} records`} <i>·</i> Local prototype</span></footer>
        </div>
      </main>

      {showHelp && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowHelp(false); }}><section className="help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title"><button className="dialog-close" onClick={() => setShowHelp(false)} aria-label="Close">×</button><div className="panel-kicker">ABOUT THIS PROTOTYPE</div><h2 id="help-title">Useful signals, with honest data</h2><p>The starter dataset is fictional. Booking.com’s customer terms prohibit automated access and copying without prior express written permission. This app imports authorized CSV or JSON data and does not fetch from Booking.com.</p><p>Sentiment is a rating bucket (8–10 positive, 7 mixed, 1–6 negative). Topic tags use a small keyword dictionary, so they are directional and should be checked against the review.</p><a href="https://www.booking.com/content/terms.html" target="_blank" rel="noreferrer">Read Booking.com terms ↗</a></section></div>}
      {toast && <div className="toast show" role="status" aria-live="polite">{toast}</div>}
    </div>
  );
}
