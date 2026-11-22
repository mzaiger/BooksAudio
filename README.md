# Books & Audio

The top 100 books, audio books and podcasts on Apple's charts, on one page. Pick a source, choose when each item launched (1, 2, 3, 6 or 12 months, or All), switch between tiles and rows, and sort by ranking or newest. Every item links out to Amazon, Barnes & Noble, Audible, Spotify, YouTube and more.

It is a plain static site: `index.html`, `app.js`, `style.css` and three JSON files, with no build step, no API keys and no dependencies. A small Python script rebuilds the JSON, and GitHub Actions runs it every 6 hours.

**Live:** `https://marcitech.is-a.dev/BooksAudio/`

## What it shows

Three source tabs, each with the current top 100 from Apple's US charts:

| Tab | Chart | "Launched" date |
|---|---|---|
| Books | Top Paid Books (Top Free Books if Top Paid can't be fetched) | Publication date |
| Audio Books | Top Audiobooks | Publication date |
| Podcasts | Top Podcasts | Date of the earliest episode found in the show's feed |

Each tile has the cover, title, author, a description (four lines, with See more / See less), the launch date, the real Apple chart position ("Apple #12 chart"), a favorite star (top left), a rank pill (top right) and the link buttons.

- **Month filter.** 1, 2, 3, 6, 12 months or All (3 months by default). The rank pill is the position among items launched in the last 12 months, so a 1 month view can show items like #34. All is the current top 100 chart whatever the launch date. The "Apple #" at the bottom of a tile is always the real chart position.
- **Layout and Sort.** Tiles or Rows (a table with the rank column first), sorted by Ranking or Newest.
- **Podcast dates.** Shows with very large feeds (over about 6 MB) have no date, so they only appear under All.
- **Favorites.** Tap the star to save an item. Favorites sit in a box at the top of the tab with a Clear button, and each one is saved in your browser as a snapshot, so it stays even after the item drops off the chart.
- **Saved settings.** The source, month filter, layout, sort and favorites are remembered in `localStorage` (`ba_source`, `ba_months`, `ba_layout`, `ba_sort`, `ba_favs`).
- **Last updated and Refresh.** The header shows how long ago the data was built. Refresh re-downloads the current tab's JSON file, skipping the browser cache; it doesn't rebuild the data.

### Link buttons

Every button shows the company's favicon, its name and an arrow. A slash below marks the end of a line of buttons.

| Tab | Buttons |
|---|---|
| Books | Amazon, Google Books / Apple Books, Goodreads / Barnes & Noble |
| Audio Books | Audible, Amazon / Apple Books, Spotify |
| Podcasts | Apple Podcasts, Spotify / YouTube, Amazon Music |

The Apple buttons open the item's own Apple page. The others are searches for the title and author (YouTube searches the title plus "podcast"), so they are not guaranteed to land on the exact item.

## How it works

- **No backend.** When you open a tab, the page fetches `data/<tab>.json` from the same site and keeps it in memory for the session.
- **`fetch_data.py`** (Python 3, standard library only) builds the three files:
  1. Downloads each chart (title, author, link, release date, cover) from Apple's free, keyless Marketing Tools RSS API for the US store, trying each address up to three times.
  2. Looks the items up in the iTunes Lookup API, 50 at a time, for the description and a larger (400x400) cover.
  3. For podcasts, reads up to 6 MB of each show's RSS feed for the description (the genre if the feed has none) and the earliest episode date.
  4. Works out each item's rank for every month window.

  If a chart still fails, the script keeps that tab's old file and updates the others.
- **`.github/workflows/update.yml`** runs the script every 6 hours and on demand (Actions tab, then Run workflow), using Python 3.12. If anything in `data/` changed, it commits as `github-actions[bot]` with the message "Update charts", retrying the push up to 5 times in case another run pushed first. Runs never overlap, and no secrets are needed.

### Data format

Each file looks like `{"updated": "<UTC timestamp>", "metric": "apple chart", "items": [...]}`. An item has `id`, `title`, `author`, `image`, `url`, `metric` (the real chart position), `desc`, `date` (`YYYY-MM-DD` or `null`), `genre` and `ranks`.

`ranks` maps a window to the item's rank in it: `"0"` is All (the chart position), and `"1"`, `"2"`, `"3"`, `"6"` and `"12"` are the month windows. An item with no entry for a window isn't shown in that window.

## Files

```
index.html                    page shell: header, controls, footer notes
app.js                        tabs, month filter, tiles and rows, favorites, link buttons
style.css                     all styles
fetch_data.py                 builds the three JSON files from Apple's charts
data/books.json               Books chart
data/audiobooks.json          Audio Books chart
data/podcasts.json            Podcasts chart
.github/workflows/update.yml  scheduled refresh
```

## Configuration

- **Link buttons.** In `app.js`, the `L` table defines each button (label, short name, favicon domain, URL), and `SOURCES[].links` chooses which buttons each tab shows. Each inner array is one line of buttons.
- **Month windows.** `MONTHS` in `app.js` and in `fetch_data.py`. Change both together, since the ranks for each window are worked out when the data is built.
- **Charts.** `CHARTS` in `fetch_data.py` (store, chart type, how many items).
- **Schedule.** The `cron` line in `update.yml`.

## Mobile

The viewport tag opens the page at 0.62 scale on phones, and the controls bar stays at the top as you scroll. Below 1000 px wide the controls stack: sources, then the month filter, then Layout and Sort on their own line.

## Run locally

```
python fetch_data.py          # optional: rebuild data/ (needs internet)
python -m http.server 8000
# open http://localhost:8000
```

Use a local server rather than opening `index.html` directly, since the page fetches the JSON files.

## Deploy

Push to `main` and turn on GitHub Pages for the repo (Settings, then Pages, then deploy from the `main` branch root). There is nothing to build. Leave GitHub Actions enabled so the data keeps refreshing; the workflow asks for `contents: write` permission.

## Credits

Chart data and covers come from Apple's Marketing Tools charts and the iTunes Lookup API (US store). Favicons come from Google's favicon service, and the fonts (Oswald, Inter and IBM Plex Mono) from Google Fonts. Apple, Amazon, Audible, Barnes & Noble, Goodreads, Google, Spotify and YouTube are not affiliated with this site.
