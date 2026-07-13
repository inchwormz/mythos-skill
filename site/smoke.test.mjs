import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const siteRoot = fileURLToPath(new URL("./", import.meta.url))

async function readSiteFile(name) {
  return readFile(new URL(name, import.meta.url), "utf8")
}

test("the blueprint-stripped Receipts shell explains the product", async () => {
  const html = await readSiteFile("index.html")
  for (const copy of [
    "Receipts",
    "Execution evidence",
    "next_pass_packet.json",
    "Prime handoff",
    "Run provenance",
    "PACKET READY",
    "Claude",
    "Codex",
    "Grok",
    "Gemini",
  ]) {
    assert.ok(html.includes(copy), `missing product copy: ${copy}`)
  }

  for (const shellMarker of [
    "ss-site-header",
    "ss-site-nav",
    "ss-site-main",
    "ss-site-footer",
    "data-source-node-id",
    "data-blueprint-slot-id",
  ]) {
    assert.match(html, new RegExp(`\\b${shellMarker}\\b`), `missing compiler shell marker: ${shellMarker}`)
  }

  for (const target of ["runs", "evidence", "packets", "gates", "docs"]) {
    assert.ok(html.includes(`id="${target}"`), `missing Receipts anchor target: ${target}`)
    assert.ok(html.includes(`href="#${target}"`), `missing Receipts anchor: ${target}`)
  }

  assert.doesNotMatch(
    html,
    /linear\\.app|>Linear<|aria-label="Linear|\\biOS\\b|\\bSlack\\b|vehicle|Customer stories|\\bStartups\\b|\\bProjects\\b|\\bDocuments\\b|\\bInitiatives\\b|\\bIssues\\b/i,
    "customer-facing source still carries clone or demo copy",
  )
  assert.doesNotMatch(html, /data-source-node-id="web-node-00188"[^>]*viewBox="0 0 400 100"/, "cloned Linear header wordmark remains")
  assert.doesNotMatch(html, /data-source-node-id="web-node-03106"[^>]*viewBox="0 0 100 100"/, "cloned Linear footer mark remains")
  assert.match(html, /class="[^"]*receipts-models-strip[^"]*"/, "agent model text strip is missing")
  assert.doesNotMatch(html, /MR81zG_marqueeItem/, "borrowed customer logo marquee remains")
})

test("the Receipts workbench uses the measured terminal grammar", async () => {
  const [html, css] = await Promise.all([readSiteFile("index.html"), readSiteFile("styles.css")])

  for (const marker of [
    "receipts-linear-terminal-frame",
    "receipts-cli-grid",
    "receipts-cli-terminal",
    "receipts-cli-surface",
    "receipts-cli-header",
    "receipts-cli-controls",
    "receipts-cli-body",
    "receipts-cli-line",
    "receipts-cli-fade",
    "receipts-cli-cursor",
    "subagent",
    "prime / cli",
    "run_id",
    "receipt_id",
    "exit_code",
    "content_hash",
    "source_refs",
    "next_action",
    "next_pass_packet.json",
  ]) {
    assert.ok(html.includes(marker), `missing terminal workbench marker: ${marker}`)
  }

  assert.equal((html.match(/receipts-cli-terminal"/g) ?? []).length, 2, "the hero must contain exactly two animated CLI terminals")
  assert.doesNotMatch(html.slice(html.indexOf("receipts-linear-terminal-frame"), html.indexOf("receipts-terminal-workbench-legacy")), /receipts-linear-terminal-(?:code|column|line-number|line-focus)/, "code-diff styling remains in the visible hero")
  assert.doesNotMatch(html.slice(html.indexOf("receipts-linear-terminal-frame"), html.indexOf("receipts-terminal-workbench-legacy")), /receipts-terminal-(?:rail|tabs|thread-card|summary-card|statusbar|verify-block|output-callout)/, "dashboard chrome remains in the visible hero")
  assert.doesNotMatch(html, /JgFxua_wrapper|_8fVXdW_codeSectionDesktop/, "borrowed HTML or code-diff mockup remains")
  assert.doesNotMatch(
    html,
    /Capture the command output before handing the result to Prime\.|Evidence chain is intact\. Prime can continue without guessing\.|The command completed cleanly; the evidence needed for the next pass is attached\./,
    "terminal UI still contains sales-copy paragraphs",
  )
  assert.doesNotMatch(html, /receipts-terminal-(?:window-dot|status-led|rail-pulse)/, "terminal still uses orb markers")
  assert.doesNotMatch(html, /receipts-terminal-(?:blue|green)/, "terminal still uses AI color classes")

  for (const selector of [
    'data-receipts-action="run"',
    "data-receipts-status",
    'aria-live="polite"',
  ]) {
    assert.ok(html.includes(selector), `missing interaction hook: ${selector}`)
  }

  assert.match(html, /addEventListener\(["']click["']/)
  assert.match(css, /@media/)
  assert.match(css, /overflow-x:\s*hidden/)
  assert.match(css, /receipts-linear-terminal-frame/)
  assert.match(css, /\.receipts-cli-grid[\s\S]{0,240}grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(html, /--grid-areas-desktop:\s*&quot;a a a a b b b b c c c c&quot;/, "the benefits section must stay a horizontal desktop grid")
  assert.doesNotMatch(html, /Resend CLI/i, "borrowed Resend CLI branding remains in the page")
  assert.match(css, /font-family:\s*"GeistSans"/)
  assert.match(css, /font-family:\s*"Fraunces"/)
  assert.match(css, /--receipts-heading-font:\s*"Fraunces"/, "content headings need the SiteSorted Fraunces font")
  assert.match(css, /main\s+:where\(h1, h2, h3, h4, h5, h6\)/, "all main headings need the Fraunces rule")
  assert.match(css, /\.TZTsQG_header, \.TZTsQG_header \*/)
  assert.match(css, /var\(--font-monospace\)/)
  assert.match(css, /\.ss-circle,\s*\[class\*="grid-dot-"\]/, "orb visuals need a kill switch")
  assert.match(css, /--receipts-terminal-accent:\s*#/, "terminal palette needs a warm neutral accent")
  assert.match(css, /receipts-terminal-workbench-review\s*\{\s*display:\s*none/, "the duplicate review terminal must stay hidden")
  assert.doesNotMatch(css, /Terminal-only landing surface/, "obsolete whole-site hiding rule remains")
  assert.doesNotMatch(css, /receipts-full-site-restored/, "forced block-layout restoration remains")
  assert.match(css, /\.receipts-cli-terminal[\s\S]{0,420}height:\s*24rem/, "the measured terminal height is missing")
  assert.match(css, /\.receipts-cli-terminal[\s\S]{0,420}border-radius:\s*24px/, "the measured terminal radius is missing")
  assert.match(css, /@keyframes\s+receipts-cli-reveal/, "terminal reveal animation is missing")
  assert.match(css, /@keyframes\s+receipts-cli-cursor/, "terminal cursor animation is missing")
  assert.match(
    css,
    /:has\(> \[data-ss-static-paint-snapshot\]\[src\^="assets\/receipts\/"\]\)[\s\S]{0,260}> :not\(\[data-ss-static-paint-snapshot\]\)[\s\S]{0,160}display:\s*none/,
    "the cloned demo DOM behind each terminal product image must be removed",
  )
  assert.match(
    css,
    /\[data-ss-static-paint-snapshot\]\[src\^="assets\/receipts\/"\][\s\S]{0,420}height:\s*auto[\s\S]{0,220}mix-blend-mode:\s*normal[\s\S]{0,220}opacity:\s*1[\s\S]{0,220}position:\s*relative[\s\S]{0,220}width:\s*100%/,
    "terminal product images must preserve their full aspect ratio instead of blending or cropping",
  )
  assert.match(css, /:focus-visible/)
})

test("the stripped shell keeps its materialized assets local", async () => {
  const html = await readSiteFile("index.html")
  const localUrls = [...html.matchAll(/(?:src|href)="(?!https?:|mailto:|data:|#|javascript:)([^"]+)"/g)].map((match) => match[1])

  for (const url of localUrls) {
    assert.ok(!url.includes(".."), `local asset escapes site root: ${url}`)
    assert.ok(!url.startsWith("/"), `host-relative asset bypasses Worker map: ${url}`)
    assert.ok(url === "styles.css" || url === "images/favicon.svg" || url.startsWith("assets/"), `unexpected local asset: ${url}`)
  }

  const assets = await readdir(new URL("./assets/files/", import.meta.url))
  assert.ok(assets.length >= 20, `expected compiler-materialized assets, found ${assets.length}`)
  assert.ok(assets.includes("geist.woff2"), "SiteSorted Geist font asset is missing")
  assert.ok(assets.includes("fraunces.woff2"), "SiteSorted Fraunces heading font asset is missing")
  const generatedAssets = [...html.matchAll(/assets\/receipts\/(receipts-\d{2}\.png)/g)].map((match) => match[1])
  assert.deepEqual(
    [...new Set(generatedAssets)].sort(),
    ["receipts-01.png", "receipts-02.png", "receipts-03.png", "receipts-04.png"],
    "only the four terminal product images should remain wired into the site",
  )
  assert.doesNotMatch(html, /assets\/receipts\/receipts-(?:0[5-9]|1\d|20)\.png/, "decorative generated avatars remain wired")
  assert.doesNotMatch(html, /assets\/(?:files\/asset-(?:0007|0008|0009|0010|0011|0012|0013|0014|0015|0018|0019|0020|0021|0022|0023)\.avif|snapshots\/asset-002[6-9]\.png)/, "borrowed Linear raster assets remain wired")
  assert.ok(siteRoot.endsWith("site\\") || siteRoot.endsWith("site/"))
})

test("the rejected generic image batch cannot return", async () => {
  const rejectedHashes = new Set([
    "5b17c2273041113c337bf40a36518f504531954084f37a056463cbdab4a257c8",
    "77185030fb17193778d3ca5c7260fb178df202a3e3379c3454177796745692c7",
    "c859101a538b75c94cc654e30b626e737ad3798441a202f0e6383c6c80883729",
    "811de8c493f8792e65581b9d5f3ea33fc9c8f98a54c1041411284da7066df78c",
    "30e44e7f14c8754314cd4fbd80700abda49b88bfc0376843a1ca6c8271e4d570",
    "6dc544e74136a750a7400e8a19c3ff009a210dd3f1e32d152871f2df42d89047",
    "862111ca50d6ea57b355f4886003d437a89d989d28b744e52f5b5054940388a2",
    "f61bf8cdcaccc608e7ab4ebb8377a626232571c6dededa8d2c5c2d7fff819472",
    "608bea84f76c2fe02bea3dbe890367ad11f3e19aba81c875b94b108780c1bd7c",
    "dfd0282d50fb56e0fc791c7ed569836b779a06a160961d693bf371d50d3d4145",
    "81a831367177e5be3ab425a030b5d9ccd716750752d7d188c23e469e32bcf840",
    "f5ebcd26c01c8a7e2373c395f660b66ba0de371cbc4cfdabe467640d17967395",
    "a5b749bcbcf45b157c88488cba24e08e00389694167814b24165af7b0ca0c71d",
    "3b035cf85f04b75e769c296e172b6975dd875d6d7942b3b7722568ddf95a45c5",
    "3895b7ac8076fad446821401aa7d62a5c6df8f30507a52a0867ad562cca38c0f",
    "b26f85e13f0614f93d94cfd616476da05ee541889b9ebc3866e6fde1b345911c",
    "443c551e112b1c54d95963bde5c49864af2b9b39cbb369aae1ca2fd5658838cd",
    "9e15de114027035a7ac3aa052e2856099e7b4f828323d3b87926eb17a15f889e",
    "5c99d7087a86ea076c27cf6247693b18a42c3f804c30304f6c1f59881b34c44e",
    "90bd39fafdeb93d872e43d3d3a62018d82121b0e6db014607cfd9c90977f8e2b",
  ])

  for (let index = 1; index <= 4; index += 1) {
    const name = `assets/receipts/receipts-${String(index).padStart(2, "0")}.png`
    const image = await readFile(new URL(name, import.meta.url))
    const hash = createHash("sha256").update(image).digest("hex")
    assert.ok(!rejectedHashes.has(hash), `rejected generic image remains: ${name}`)
  }
})
