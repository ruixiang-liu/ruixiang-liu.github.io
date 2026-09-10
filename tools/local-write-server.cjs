/**
 * Local-only HTML overwrite server for the site editor.
 * Run: node tools/local-write-server.cjs
 * Listens on 127.0.0.1:8791 — never bind to a public interface.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(
  "D:\\OneDrive - The Pennsylvania State University\\PhD\\ruixiang-liu.github.io"
);
const PORT = 8791;
const HOST = "127.0.0.1";

const ALLOWED = new Set([
  "index.html",
  "about.html",
  "research.html",
  "publications.html",
  "teaching.html",
  "news.html",
  "contact.html",
]);

const send = (res, status, body, type = "application/json; charset=utf-8") => {
  const data = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": type,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(data);
};

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    send(res, 204, "");
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    send(res, 200, { ok: true, root: ROOT });
    return;
  }

  if (req.method !== "POST" || req.url !== "/write") {
    send(res, 404, { ok: false, error: "Not found" });
    return;
  }

  let raw = "";
  req.on("data", (chunk) => {
    raw += chunk;
    if (raw.length > 8 * 1024 * 1024) req.destroy();
  });
  req.on("end", () => {
    try {
      const payload = JSON.parse(raw || "{}");
      const files = Array.isArray(payload.files) ? payload.files : [payload];
      const written = [];

      for (const item of files) {
        const name = String(item.file || "").replace(/^.*[\\/]/, "");
        if (!ALLOWED.has(name)) {
          send(res, 400, { ok: false, error: "File not allowed: " + name });
          return;
        }
        if (typeof item.html !== "string") {
          send(res, 400, { ok: false, error: "Missing html for " + name });
          return;
        }
        const target = path.join(ROOT, name);
        if (!target.startsWith(ROOT)) {
          send(res, 400, { ok: false, error: "Invalid path" });
          return;
        }
        fs.writeFileSync(target, item.html, "utf8");
        written.push(target);
      }

      send(res, 200, { ok: true, written });
    } catch (err) {
      send(res, 500, { ok: false, error: String(err && err.message ? err.message : err) });
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Local write server ready at http://${HOST}:${PORT}`);
  console.log(`Writing only into: ${ROOT}`);
  console.log("Allowed files:", [...ALLOWED].join(", "));
});
