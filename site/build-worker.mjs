import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = await readFile(resolve(repoRoot, "site/index.html"), "utf8");
const favicon = await readFile(resolve(repoRoot, "site/images/favicon.svg"), "utf8");
const output = resolve(repoRoot, "dist/server/index.js");

const worker = `const html = ${JSON.stringify(html)};
const favicon = ${JSON.stringify(favicon)};

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    if (url.pathname === "/images/favicon.svg") {
      return new Response(favicon, {
        headers: { "content-type": "image/svg+xml" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};
`;

await mkdir(dirname(output), { recursive: true });
await writeFile(output, worker, "utf8");
console.log(`Built ${output}`);
