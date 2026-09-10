/* Site-wide options for Contact page widgets. */
window.SITE_CONFIG = {
  // Google Maps place query for the office / department building
  officeMapQuery:
    "Penn State Department of Geography, Walker Building, 302 N Burrowes Rd, University Park, PA 16802, USA",

  // MapMyVisitors widget id (the `d=` value from your embed code).
  // Create one at https://mapmyvisitors.com/ → Create Widget / Sign up,
  // then paste only the id here, e.g. "wD3JfzE73T8e5QsTmDGjp7waevxKsTdD9pnyNVnclKI"
  mapMyVisitorsId: "TYxB1CuDS_AaQrS7UbF0J0MxRizEYe1MEJwKpKQxCUQ",

  // Local write API (optional; used if you run tools/local-write-server.mjs)
  localWriteUrl: "http://127.0.0.1:8791/write",

  // data-page → fixed HTML file names
  pageFiles: {
    home: "index.html",
    about: "about.html",
    research: "research.html",
    publications: "publications.html",
    teaching: "teaching.html",
    news: "news.html",
    contact: "contact.html",
  },
};
