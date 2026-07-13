import assert from "node:assert/strict"
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

test("the Receipts workbench keeps local actions and responsive guardrails", async () => {
  const [html, css] = await Promise.all([readSiteFile("index.html"), readSiteFile("styles.css")])

  for (const marker of [
    "receipts-terminal-workbench",
    "receipts-terminal-windowbar",
    "receipts-terminal-pane-grid",
    "receipts-terminal-thread",
    "receipts-terminal-summary-metrics",
    "receipts-terminal-output-window",
    "receipts-terminal-packet-rail",
    "receipts-terminal-code-line",
    "receipts-terminal-statusbar",
    "subagent",
    "prime / cli",
    "READY",
    "PACKET READY",
    "run_id",
    "receipt_id",
    "exit_code",
    "content_hash",
    "source_refs",
    "artifacts",
    "gate",
    "next_action",
    "next_pass_packet.json",
  ]) {
    assert.ok(html.includes(marker), `missing terminal workbench marker: ${marker}`)
  }

  assert.ok((html.match(/data-receipts-terminal="subagent"/g) ?? []).length >= 2, "subagent terminal panes are missing")
  assert.ok((html.match(/data-receipts-terminal="prime"/g) ?? []).length >= 2, "Prime terminal panes are missing")
  assert.ok((html.match(/receipts-terminal-code-line/g) ?? []).length >= 26, "line-numbered packet output is too shallow")
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
  assert.match(css, /receipts-terminal-workbench/)
  assert.match(css, /grid-template-columns:\s*minmax\(0, \.92fr\)/)
  assert.match(css, /font-family:\s*"GeistSans"/)
  assert.match(css, /font-family:\s*"Fraunces"/)
  assert.match(css, /--receipts-heading-font:\s*"Fraunces"/, "content headings need the SiteSorted Fraunces font")
  assert.match(css, /main\s+:where\(h1, h2, h3, h4, h5, h6\)/, "all main headings need the Fraunces rule")
  assert.match(css, /\.TZTsQG_header, \.TZTsQG_header \*/)
  assert.match(css, /var\(--font-monospace\)/)
  assert.match(css, /\.ss-circle,\s*\[class\*="grid-dot-"\]/, "orb visuals need a kill switch")
  assert.match(css, /--receipts-terminal-accent:\s*#/, "terminal palette needs a warm neutral accent")
  assert.match(css, /receipts-terminal-workbench-review\s*\{\s*display:\s*none/, "the duplicate review terminal must stay hidden")
  assert.match(css, /:not\(\.receipts-terminal-workbench-hero\)/, "marketing sections must stay hidden around the terminal pair")
  assert.match(css, /\.TZTsQG_rightSideWrapper\s*\{\s*display:\s*none/, "header copy must not compete with the terminal pair")
  assert.match(css, /receipts-terminal-toolbar,\s*\.receipts-terminal-tabs,\s*\.receipts-terminal-rail/, "terminal chrome should stay Hyper-simple")
  assert.match(css, /--receipts-terminal-surface:\s*#/, "simple terminal surface token is missing")
  assert.match(css, /receipts-terminal-workbench-hero \.receipts-terminal-thread-card[\s\S]{0,360}background:\s*transparent/, "subagent output should not read as a dashboard card")
  assert.match(css, /receipts-terminal-workbench-hero \.receipts-terminal-output-window[\s\S]{0,360}background:\s*transparent/, "prime output should stay a plain terminal stream")
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
  assert.ok(siteRoot.endsWith("site\\") || siteRoot.endsWith("site/"))
})
