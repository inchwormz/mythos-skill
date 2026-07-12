import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const siteRoot = resolve(repoRoot, "site");
const output = resolve(repoRoot, "dist/server/index.js");

const contentTypes = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

async function collectFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(path)));
    else files.push(path);
  }
  return files;
}

const requestedFiles = [
  resolve(siteRoot, "index.html"),
  resolve(siteRoot, "styles.css"),
  ...(await collectFiles(resolve(siteRoot, "assets"))),
];
const favicon = resolve(siteRoot, "images/favicon.svg");
try {
  await readFile(favicon);
  requestedFiles.push(favicon);
} catch {}

const assets = [];
for (const path of requestedFiles) {
  const pathname = `/${relative(siteRoot, path).replaceAll("\\", "/")}`;
  assets.push({
    body: (await readFile(path)).toString("base64"),
    contentType: contentTypes[extname(path).toLowerCase()] ?? "application/octet-stream",
    pathname,
  });
}

const worker = `const assets = new Map(${JSON.stringify(assets.map(({ pathname, body, contentType }) => [pathname, { body, contentType }]))});

function decode(body) {
  return Uint8Array.from(atob(body), (character) => character.charCodeAt(0));
}

export default {
  async fetch(request) {
    const pathname = new URL(request.url).pathname;
    const asset = assets.get(pathname === "/" ? "/index.html" : pathname);
    if (!asset) return new Response("Not found", { status: 404 });
    return new Response(decode(asset.body), {
      headers: { "content-type": asset.contentType },
    });
  },
};
`;

await mkdir(dirname(output), { recursive: true });
await writeFile(output, worker, "utf8");
console.log(`Built ${output} with ${assets.length} assets`);
