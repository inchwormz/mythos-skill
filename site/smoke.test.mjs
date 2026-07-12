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
    "Packet awaiting next agent",
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
  assert.ok(siteRoot.endsWith("site\\") || siteRoot.endsWith("site/"))
})
