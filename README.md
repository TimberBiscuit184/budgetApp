# Budget & Card Analysis

A personal budgeting and spending-analysis web app, built as a single self-contained HTML file. It imports Wells Fargo checking and credit-card CSV exports, auto-categorizes transactions, and turns them into a live budget with charts, spending goals, subscription tracking, and cross-device sync via Google Drive. It installs to a phone home screen as a PWA and works offline.

**Live app:** https://radiant-heliotrope-5b4783.netlify.app
**Author:** Colby Shannon

---

## What it does

- **Monthly Budget** — per-category caps grouped into *Necessary* / *Unnecessary*, with live "Spent" and an "on-pace" projection for the current month. Groups are collapsible; a sticky bar keeps month/spent/left visible while scrolling on mobile.
- **Expenses** — manual logging of **cash** purchases (card/debit spending comes from CSVs, so cash is the only thing logged by hand to avoid double-counting).
- **Spending Goals** — target percentages per bucket.
- **Subscriptions** — recurring charges with a simple visual + list.
- **Card Statement Analysis** — CSV importer (drag/drop), category breakdown, per-month totals, per-bucket lines over time, top merchants, and a searchable **Transactions** browser with per-transaction category overrides and Business/Personal tagging.
- **Google Drive sync** — one private app-data file keeps all devices in sync automatically.
- **Installable + offline** — PWA meta tags + a service worker cache.

---

## How it's built

**Single file.** Everything (HTML, CSS, vanilla JS) lives in `Budget-and-Statements.html`. No framework, no build step. The only external runtime dependencies are Chart.js (chart rendering) and Google Identity Services (Drive auth), both loaded from CDNs.

**Data source.** All spending is derived from imported CSVs — there is no baked-in transaction data. On import, each row is parsed, auto-categorized by a keyword rule table, and de-duplicated. Imported transactions are the single source of truth for every chart, total, and budget number, combined with any logged cash expenses.

**Persistence.** State is saved to `localStorage` (key `colby_budget_v2`) on every change, and — when connected — pushed to Google Drive.

### Data model (`state`)

```
{
  buckets:  { [category]: { cap, group, goalPct } },   // budget caps + necessary/unnecessary
  expenses: [ { id, date, cat, amount, note } ],        // manually logged CASH only
  subs:     [ { id, name, amount, day, cat, card, note } ],
  imported: [ { card, fdate, ym, date, merchant, raw, amount, cat, ... } ] | null,  // parsed CSV txns
  txMeta:   { [txKey]: { cat?, biz? } },                // per-transaction overrides + business tags
  month:    "YYYY-MM"                                   // selected tracking month
}
```

- `txKey = card | fdate | amount(2dp) | merchant.toUpperCase()` — the dedup + override identity.
- `deriveData()` rebuilds all working arrays (`TX`, `DTX`, `STX`, `catTotals`, etc.) from `imported`, and **re-applies `txMeta` overrides on top** every time — so a manual category fix or a Business tag survives future re-imports.

### Import flow

CSV dropped → `parseCsvLine` → `rowsToTx` (classify credit/debit, exclude payoffs/transfers/ATM/deposits, auto-categorize) → de-dupe within batch by `txKey` → **review modal** (fix categories, uncheck rows) → `applyImport` merges with prior history (newest wins per `txKey`) → `deriveData` re-applies overrides → charts/budget refresh.

### Google Drive sync

- Uses Google Identity Services token client with the `drive.appdata` scope — the data file (`budget-data.json`) is stored in Drive's hidden per-app folder, invisible in the user's normal Drive and readable only by this app.
- Sync is **last-write-wins** by an embedded `_synced` timestamp: on connect it compares the local vs. remote timestamp and pulls or pushes accordingly; edits after that debounce-push (~1.5s).
- The OAuth **Client ID is public by design** and embedded in the HTML. It is NOT a secret.

### Offline (service worker)

`sw.js` pre-caches the chart library + icons + manifest, and uses network-first for page navigations (so you always get the latest when online, and a cached copy when not). Google endpoints are deliberately never cached — sign-in needs the live network.

---

## Files

| File | Purpose |
|------|---------|
| `Budget-and-Statements.html` | The entire app. |
| `sw.js` | Service worker for offline caching. |
| `manifest.webmanifest` | PWA manifest (name, colors, icons). |
| `icon-180.png` / `icon-192.png` / `icon-512.png` | Home-screen / install icons. |
| `README.md` | This document. |

All files must be deployed **together at the site root** — the HTML references the others by relative path.

---

## Running / deploying

- **Locally:** open `Budget-and-Statements.html` in a browser. Everything works **except Google Drive sync**, which requires the hosted HTTPS origin (see Known issues).
- **Hosted:** deploy the whole folder to Netlify (Deploys tab → drag the folder, so the same URL/OAuth origin is preserved). Then hard-refresh; on mobile, re-pin to the home screen.

### Google OAuth setup (already done, for reference)

1. Google Cloud project → enable **Google Drive API**.
2. **Google Auth Platform → Branding**: app name, support email, audience = External.
3. **Audience → Test users**: add your own Gmail.
4. **Clients**: create a **Web application** OAuth client; add the hosted URL (e.g. `https://radiant-heliotrope-5b4783.netlify.app`, no trailing slash) under **Authorized JavaScript origins**.
5. Paste the Client ID into `DRIVE_CLIENT_ID` in the HTML.

---

## Known issues & limitations

- **Drive sync only works on the hosted HTTPS origin.** Opening the local `file://` copy throws `origin=file://` from Google — expected; use the Netlify URL for anything that syncs.
- **No offline sign-in.** By design, Google auth needs a connection; the rest of the app works offline.
- **OAuth app is in "Testing" mode.** Only added test users can connect, and Google may require periodic re-consent (test-mode grants are time-limited). To lift this, the app would need to be published/verified.
- **Dedup can still miss** when the *same* purchase exports with a different date, amount, or description across weeks (e.g. pending vs. posted). The Transactions override tools mitigate the fallout, but the matcher itself hasn't been hardened for fuzzy matches.
- **Business/Personal tags apply to imported transactions only**, not logged cash expenses.
- **Collapsed group state is not remembered** between sessions (resets to expanded on reload).
- **Single-file architecture** is simple but getting large; there's no module system, tests, or build tooling.
- **Chart.js / GIS come from CDNs.** The service worker caches Chart.js, but a CDN outage on first load (before caching) would affect charts.

---

## Ideas / roadmap (not yet built)

- **Income + net cash flow** — currently spend-only; add income so the app shows whether each month is net positive.
- **Month-over-month trends** — "what went up vs. last month," biggest movers.
- **Over-cap alerts** and a one-tap monthly summary / export.
- **Harden dedup** — fuzzy match on date/amount/normalized merchant, or flag likely duplicates in the review modal.
- **Persist collapse state** and other UI prefs.
- **Recurring-charge auto-detection** from CSVs to auto-populate Subscriptions.
- **Business tagging for logged cash** + a business-expense export for tax time.
- **Publish the OAuth app** to remove the test-user restriction.

---

## Project history (how we got here)

Built iteratively: started by parsing Wells Fargo statements into a two-tab budget + analysis view; added Necessary/Unnecessary grouping, a spending-over-time line chart, spending goals, cash logging, and subscriptions; replaced the static statement data with a **live CSV importer** (parse + auto-categorize + dedupe) as the sole source of truth; fixed double-counting; added **Google Drive auto-sync**, **mobile/PWA** support (bottom nav, quick-add, sticky header, collapsible groups), **per-transaction category overrides + Business/Personal tagging**, and a **service worker for offline**.
