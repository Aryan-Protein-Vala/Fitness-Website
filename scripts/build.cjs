const { mkdirSync, cpSync } = require("node:fs");

mkdirSync("dist", { recursive: true });
for (const path of ["index.html", "my-guides.html", "robots.txt", "sitemap.xml", "assets"]) {
  cpSync(path, `dist/${path}`, { recursive: true });
}
