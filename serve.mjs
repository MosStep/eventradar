// Tiny static server: web/ at /, data/ at /data/. Usage: node serve.mjs [port]
// EVENTS_FILE=path overrides /data/events.json (handy for testing with sample data).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = import.meta.dirname;
const PORT = Number(process.argv[2] || process.env.PORT || 5173);
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png" };

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  let file = url.startsWith("/data/") ? path.join(ROOT, url) : path.join(ROOT, "web", url === "/" ? "index.html" : url);
  if (url === "/data/events.json" && process.env.EVENTS_FILE) file = process.env.EVENTS_FILE;
  if (!file.startsWith(ROOT) && !process.env.EVENTS_FILE) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, body) => {
    if (err) { res.writeHead(404).end("not found"); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" }).end(body);
  });
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
