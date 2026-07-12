import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const siteRoot = fileURLToPath(new URL("./", import.meta.url))

async function readSiteFile(name) {
  return readFile(new URL(name, import.meta.url), "utf8")
}

test("the page preserves the actual SiteSorted shell while explaining Receipts", async () => {
  const html = await readSiteFile("index.html")
  const requiredCopy = [
    "Receipts",
    "What are you trying to prove?",
    "next_pass_packet.json",
    "Prime",
    "cargo install mythos-skill",
  ]

  for (const copy of requiredCopy) {
    assert.ok(html.includes(copy), `missing product copy: ${copy}`)
  }

  for (const shellMarker of [
    'data-receipts-skeleton-run="receipts-launch-shell"',
    'class="page-header"',
    'class="composer"',
    'class="templates"',
    'class="features"',
    'class="mobile-sites"',
    'class="blog-section"',
    'class="cta"',
    'class="page-footer"',
  ]) {
    assert.ok(html.includes(shellMarker), `missing cloned shell marker: ${shellMarker}`)
  }

  assert.doesNotMatch(html, /SiteSorted/i, "customer-facing source still carries SiteSorted branding")

  const anchorTargets = [...html.matchAll(/href="#([^\"]+)"/g)].map((match) => match[1])
  for (const target of anchorTargets) {
    assert.match(html, new RegExp(`(?:id|aria-labelledby)="${target}"`), `missing anchor target: ${target}`)
  }
})

test("the cloned composer keeps useful local interactions and responsive guardrails", async () => {
  const html = await readSiteFile("index.html")

  for (const selector of [
    "data-launch-submit",
    "data-launch-chip",
    "launch-ceo-toggle",
    "launch-ceo-panel",
    "aria-live=\"polite\"",
  ]) {
    assert.ok(html.includes(selector), `missing interaction hook: ${selector}`)
  }

  assert.match(html, /addEventListener\(["']click["']/)
  assert.match(html, /@media \(max-width: 900px\)/)
  assert.match(html, /overflow-x:\s*hidden/)
  assert.match(html, /:focus-visible/)
  assert.doesNotMatch(html, /fetch\(/, "static product site should not call the SiteSorted API")
})

test("the landing page keeps local assets inside the site surface", async () => {
  const html = await readSiteFile("index.html")
  const localUrls = [...html.matchAll(/(?:src|href)="(?!https?:|mailto:|data:|#|javascript:)([^"]+)"/g)].map((match) => match[1])

  for (const url of localUrls) {
    assert.ok(!url.includes(".."), `local asset escapes site root: ${url}`)
    assert.ok(url.startsWith("./") || url.startsWith("/"), `local asset should be explicit: ${url}`)
  }

  assert.ok(siteRoot.endsWith("site\\") || siteRoot.endsWith("site/"))
})
