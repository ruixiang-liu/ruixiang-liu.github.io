# Ruixiang Liu — Academic Homepage

| Page | File |
| --- | --- |
| Home | `index.html` |
| About | `about.html` |
| Research | `research.html` |
| Publications | `publications.html` |
| Teaching | `teaching.html` |
| News | `news.html` |
| Contact | `contact.html` |

## Local preview

Run a static server from the repository root, then open the local address:

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Preview: `http://127.0.0.1:8000/`. The site is static and needs no build step.
The optional local page editor is available with `?edit=1`, for example
`http://127.0.0.1:8000/about.html?edit=1`. Ordinary previews always use the
files on disk, so saved editor drafts cannot hide newer changes.

## Content maintenance

- Content and the downloadable PDF were updated from the November 2026 CV.
- Keep published articles separate from work in progress in `publications.html`.
- Keep the first five items in the home page news list aligned with `news.html`.
  JavaScript also refreshes that list from the news page.
- Replace `assets/Ruixiang_CV.pdf` when updating the CV and update the footer date.
- Shared appearance lives in `css/styles.css`; `js/main.js` handles navigation.
- Review locally before committing or pushing to GitHub Pages.

## Historical visitor map

The contact page plots all available geolocated visits from `assets/data/visitor-history.json`.
Unknown locations are excluded from map pins; country-only records are labeled as such.
MapMyVisitors continues collecting visits under the existing widget ID through its image counter.
The provider's embedded map only covers recent visits, so it is no longer used for display.

`tools/update-visitor-history.py` refreshes the historical aggregates from the public statistics
page. It checks that the returned date range covers the complete recording history and retains
the last good data if the provider response is incomplete or invalid. Only aggregate locations
and counts are stored; individual visitor records and IP addresses are not published.

The `Update historical visitor map` GitHub Actions workflow runs daily at 10:23 UTC and can also be
run manually. After updating the JSON, it explicitly requests a GitHub Pages build so the
map refreshes on the published site. It uses the existing branch-based Pages configuration.
The schedule becomes active only after the workflow is pushed to the default branch.
