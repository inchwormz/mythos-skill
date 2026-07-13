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

  const hero = html.slice(html.indexOf("receipts-linear-terminal-frame"), html.indexOf("receipts-terminal-workbench-legacy"))
  assert.equal((hero.match(/receipts-cli-terminal"/g) ?? []).length, 2, "the hero must contain exactly two animated CLI terminals")
  assert.doesNotMatch(hero, /receipts-linear-terminal-(?:code|column|line-number|line-focus)/, "code-diff styling remains in the visible hero")
  assert.doesNotMatch(hero, /receipts-terminal-(?:rail|tabs|thread-card|summary-card|statusbar|verify-block|output-callout)/, "dashboard chrome remains in the visible hero")
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
  assert.match(css, /:focus-visible/)
})

test("the four product scenes reuse the hero terminal DOM instead of images", async () => {
  const [html, css] = await Promise.all([readSiteFile("index.html"), readSiteFile("styles.css")])
  const scenes = [...html.matchAll(/<article class="receipts-cli-terminal receipts-feature-terminal[^"]*"[\s\S]*?<\/article>/g)].map((match) => match[0])

  assert.equal(scenes.length, 4, "all four product-image slots must be rebuilt as hero-style terminals")
  assert.doesNotMatch(html, /assets\/receipts\/receipts-0[1-4]\.png/, "raster product scenes remain wired into the page")
  assert.doesNotMatch(html, /data-ss-static-paint-snapshot="true"[^>]*assets\/receipts\//, "Receipts product scenes still use static image snapshots")

  for (const [index, scene] of scenes.entries()) {
    for (const marker of [
      "receipts-cli-surface",
      "receipts-cli-header",
      "receipts-cli-controls",
      "receipts-cli-body",
      "receipts-cli-command",
      "receipts-cli-lines",
      "receipts-cli-line",
      "receipts-cli-cursor",
      "receipts-cli-fade",
    ]) {
      assert.ok(scene.includes(marker), `product scene ${index + 1} is missing hero terminal marker: ${marker}`)
    }
  }

  for (const command of ["receipts run", "receipts absorb", "receipts conclude", "receipts next"]) {
    assert.ok(html.includes(command), `missing product terminal command: ${command}`)
  }

  assert.match(
    css,
    /:has\(> \.receipts-feature-terminal\)[\s\S]{0,180}> :not\(\.receipts-feature-terminal\)[\s\S]{0,120}display:\s*none/,
    "the cloned demo DOM behind each HTML terminal must be removed",
  )
  assert.doesNotMatch(css, /\[data-ss-static-paint-snapshot\]\[src\^="assets\/receipts\/"\]/, "obsolete raster compositor CSS remains")
})

test("the visible shell is fully Receipts-owned with no Linear brand residue", async () => {
  const [html, css] = await Promise.all([readSiteFile("index.html"), readSiteFile("styles.css")])

  assert.equal((html.match(/class="receipts-wordmark"/g) ?? []).length, 2, "header and footer must use the Receipts wordmark")
  assert.match(css, /\.receipts-wordmark[\s\S]{0,260}font-family:\s*var\(--receipts-heading-font\)/, "the Receipts wordmark must use Fraunces")
  assert.doesNotMatch(html, /data-source-node-id="web-node-(?:00188|03106)"/, "the old header or footer icon mark remains")

  const proofFigures = [...html.matchAll(/data-receipts-proof="(trust|determinism|handoff)"/g)].map((match) => match[1])
  assert.deepEqual(proofFigures.sort(), ["determinism", "determinism", "handoff", "handoff", "trust", "trust"], "mobile and desktop need all three Receipts proof figures")
  assert.doesNotMatch(html, /_3fVNxW_agentsWrapper|GJ9TEa_momentum|FIG 0\.[234]/, "borrowed benefit illustration system remains")

  for (const label of ["HOUR 00", "HOUR 04", "HOUR 08", "HOUR 12", "HOUR 16", "HOUR 20", "HOUR 24", "HOUR 28"]) {
    assert.ok(html.includes(`>${label}<`), `missing harness elapsed-time label: ${label}`)
  }

  assert.doesNotMatch(html, />(?:FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|Backlog|Todo|In Progress|Done|Alpha|GA)</, "calendar or project-management residue remains visible")
  assert.doesNotMatch(html, /OpenAI|Ramp|Staff Software Engineer|Head of Engineering|33,000|Dc5tqa_logoDesktop/, "borrowed testimonial identity remains")
  assert.match(css, /\.receipts-proof-card\s+\.Dc5tqa_primaryLogo[\s\S]{0,120}display:\s*none/, "borrowed testimonial logo nodes remain visible")
  assert.match(css, /\.b-30Va_footer[\s\S]{0,80}display:\s*none/, "borrowed pulse footer remains visible")
  assert.match(css, /\[fill="\#4354B8"\][\s\S]{0,620}fill:\s*var\(--receipts-terminal-accent\)/, "borrowed blue diagram palette remains visible")
  assert.match(css, /\.LwA8Xa_barTop[\s\S]{0,160}background:\s*var\(--receipts-terminal-accent\)/, "borrowed cyan evidence bars remain visible")
  assert.doesNotMatch(html, />(?:Open workspace|Coding Sessions|Mobile|Switch|Download|DPA|AUP)</, "borrowed navigation or footer copy remains")
  assert.doesNotMatch(html, /Prevent duplicate ride requests|Clean up deprecated APIs|Prime agent workspace idle/, "generic demo task copy remains")
  for (const copy of ["View source", "Harness runs", "Strict mode", "Receipt schema", "MIT license"]) {
    assert.ok(html.includes(copy), `missing Receipts-owned shell copy: ${copy}`)
  }
  assert.match(html, /assets\/receipts\/receipts-card-trust\.png/)
  assert.match(html, /assets\/receipts\/receipts-card-handoff\.png/)
  assert.match(css, /\.receipts-proof-card--trust[\s\S]{0,320}receipts-card-trust\.png/)
  assert.match(css, /\.receipts-proof-card--handoff[\s\S]{0,320}receipts-card-handoff\.png/)
  assert.match(css, /\.receipts-proof-card[\s\S]{0,360}background-repeat:\s*no-repeat/, "proof-card art must not tile")
  assert.match(css, /\.receipts-proof-card[\s\S]{0,360}background-size:\s*contain/, "proof-card art must remain legible instead of cropping into logo-like shapes")

  const [trustCard, handoffCard] = await Promise.all([
    readFile(new URL("assets/receipts/receipts-card-trust.png", import.meta.url)),
    readFile(new URL("assets/receipts/receipts-card-handoff.png", import.meta.url)),
  ])
  assert.equal(createHash("sha256").update(trustCard).digest("hex"), "073ea7daf35afbb5275f2caebc1f897cea182a8dadf38fe2fc09d0b84ac23c1a", "the first requested flow-field asset must back the trust card")
  assert.equal(createHash("sha256").update(handoffCard).digest("hex"), "11b3fd3894767b42de711027235f9d17776a6df2a82d0f7e41c340e701986d69", "the second requested flow-field asset must back the handoff card")
})

test("the one-page story removes false product sections and resolves its navigation", async () => {
  const [html, css] = await Promise.all([readSiteFile("index.html"), readSiteFile("styles.css")])

  assert.match(html, /data-receipts-one-page/, "the one-page cleanup is not installed")
  for (const selector of ["#docs", '[data-source-node-id="web-node-02502"]', ".Jmh1Wq_footer"]) {
    assert.ok(html.includes(selector), `the one-page cleanup does not remove ${selector}`)
  }

  for (const copy of ["Rust compiler", "ingests agent sessions", "proven data", "receipts absorb", "receipts conclude", "receipts next"]) {
    assert.ok(html.includes(copy), `the compiler explanation is missing: ${copy}`)
  }

  for (const id of ["runs", "evidence", "packets", "gates"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `header target #${id} is missing`)
  }

  assert.match(html, /https:\/\/github\.com\/inchwormz\/agent-receipts/)
  assert.match(html, /View Receipts on GitHub/)
  assert.match(css, /\.Jmh1Wq_footer[\s\S]{0,100}display:\s*none/, "the footer can flash before the cleanup runs")
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
  assert.deepEqual(generatedAssets, [], "generated product imagery remains wired into the site")
  assert.doesNotMatch(html, /assets\/receipts\/receipts-(?:0[5-9]|1\d|20)\.png/, "decorative generated avatars remain wired")
  assert.doesNotMatch(html, /assets\/(?:files\/asset-(?:0007|0008|0009|0010|0011|0012|0013|0014|0015|0018|0019|0020|0021|0022|0023)\.avif|snapshots\/asset-002[6-9]\.png)/, "borrowed Linear raster assets remain wired")
  assert.ok(siteRoot.endsWith("site\\") || siteRoot.endsWith("site/"))
})
