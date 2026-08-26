import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import test from "node:test";

const distDirectory = new URL("../dist/", import.meta.url);
const exportFile = new URL("index.html", distDirectory);

function parseAttributes(source) {
  const attributes = new Map();
  const pattern = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  for (const match of source.matchAll(pattern)) {
    attributes.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? "");
  }

  return attributes;
}

function readOpeningTag(html, start) {
  let quote = null;

  for (let index = start; index < html.length; index += 1) {
    const character = html[index];
    if (quote) {
      if (character === quote) quote = null;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === ">") {
      return index;
    }
  }

  return -1;
}

function inspectMarkup(html) {
  const tags = [];
  const css = [];
  const scripts = [];
  const lowerHtml = html.toLowerCase();
  let cursor = 0;

  while (cursor < html.length) {
    const start = html.indexOf("<", cursor);
    if (start === -1) break;

    if (html.startsWith("<!--", start)) {
      const end = html.indexOf("-->", start + 4);
      if (end === -1) throw new Error("Unterminated HTML comment.");
      cursor = end + 3;
      continue;
    }

    const nameMatch = html.slice(start + 1).match(/^([a-z][\w:-]*)\b/i);
    if (!nameMatch) {
      cursor = start + 1;
      continue;
    }

    const end = readOpeningTag(html, start + 1);
    if (end === -1) throw new Error(`Unterminated <${nameMatch[1]}> opening tag.`);

    const name = nameMatch[1].toLowerCase();
    const attributesSource = html.slice(start + 1 + nameMatch[0].length, end);
    tags.push({ name, attributes: parseAttributes(attributesSource) });
    cursor = end + 1;

    if (name === "script" || name === "style") {
      const closingTag = `</${name}`;
      const closeStart = lowerHtml.indexOf(closingTag, cursor);
      if (closeStart === -1) throw new Error(`Unterminated <${name}> element.`);
      const contents = html.slice(cursor, closeStart);
      if (name === "style") css.push(contents);
      if (name === "script") scripts.push(contents);
      const closeEnd = html.indexOf(">", closeStart + closingTag.length);
      if (closeEnd === -1) throw new Error(`Unterminated </${name}> closing tag.`);
      cursor = closeEnd + 1;
    }
  }

  return { tags, css, scripts };
}

function decodeUrl(value) {
  return value
    .replace(/&#(\d+);?/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);?/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&(colon|sol|amp);/gi, (_, entity) => ({ colon: ":", sol: "/", amp: "&" })[entity.toLowerCase()])
    .trim();
}

function isNetworkUrl(value) {
  const decoded = decodeUrl(value).replace(/[\t\n\r]/g, "");
  return /(?:^|[\s,;=])(?:(?:https?|wss?|ftp):|\/\/)/i.test(decoded);
}

function isInlineUrl(value) {
  const decoded = decodeUrl(value);
  return decoded.startsWith("data:") || decoded.startsWith("#");
}

function isAllowedEmbeddedResource(tag, attribute, value) {
  const decoded = decodeUrl(value);
  if (["img", "source", "audio", "video", "track"].includes(tag)) return decoded.startsWith("data:");
  if (tag === "image") return decoded.startsWith("data:") || decoded.startsWith("#");
  if (tag === "use") return decoded.startsWith("#");
  return false;
}

function parseCsp(value) {
  return new Map(value.split(";").map((directive) => directive.trim()).filter(Boolean).map((directive) => {
    const [name, ...sources] = directive.split(/\s+/);
    return [name.toLowerCase(), sources];
  }));
}

test("dist/index.html is the only production artifact", () => {
  assert.deepEqual(
    readdirSync(distDirectory).sort(),
    ["index.html"],
    "Expected dist to contain only the standalone dist/index.html artifact. Run `npm run build` first.",
  );
  assert.equal(statSync(exportFile).isFile(), true, "Expected dist/index.html to be a regular file.");
});

function validateOfflineDocument(html) {
  const failures = new Set();
  if (!/^\s*<!doctype html>/i.test(html)) failures.add("Document is missing an HTML doctype.");
  if (!/^\s*<!doctype html>\s*<html\b[^>]*>\s*<head\b[^>]*>[\s\S]*<\/head>\s*<body\b[^>]*>[\s\S]*<\/body>\s*<\/html>\s*$/i.test(html)) {
    failures.add("Document must contain one complete html/head/body structure with closing tags.");
  }

  let inspected;
  try {
    inspected = inspectMarkup(html);
  } catch (error) {
    failures.add(`Document could not be parsed: ${error instanceof Error ? error.message : String(error)}`);
    return failures;
  }

  const { tags, css, scripts } = inspected;
  if (!tags.some(({ name }) => name === "html")) failures.add("Document is missing an <html> element.");
  if (!tags.some(({ name }) => name === "head")) failures.add("Document is missing a <head> element.");
  if (!tags.some(({ name }) => name === "body")) failures.add("Document is missing a <body> element.");
  if (!tags.some(({ attributes }) => attributes.get("id") === "root")) failures.add("Document is missing the application root.");
  if (!scripts.some((script) => script.trim().length > 1_000)) failures.add("Document is missing a nonempty inline application bundle.");
  if (!css.some((stylesheet) => stylesheet.trim().length > 100)) failures.add("Document is missing a nonempty inline stylesheet.");

  const cspMetas = tags.filter(({ name, attributes }) => name === "meta" && attributes.get("http-equiv")?.toLowerCase() === "content-security-policy");
  const cspMeta = cspMetas[0];
  if (!cspMeta || cspMetas.length !== 1) {
    failures.add("Document is missing a Content-Security-Policy meta tag.");
  } else {
    const cspContent = cspMeta.attributes.get("content") ?? "";
    const directiveCount = cspContent.split(";").map((directive) => directive.trim()).filter(Boolean).length;
    const policy = parseCsp(cspContent);
    const requiredDirectives = new Map([
      ["default-src", ["'none'"]],
      ["script-src", ["'unsafe-inline'"]],
      ["style-src", ["'unsafe-inline'"]],
      ["img-src", ["data:"]],
      ["font-src", ["data:"]],
      ["connect-src", ["'none'"]],
      ["media-src", ["data:"]],
      ["object-src", ["'none'"]],
      ["frame-src", ["'none'"]],
      ["worker-src", ["'none'"]],
      ["base-uri", ["'none'"]],
      ["form-action", ["'none'"]],
      ["navigate-to", ["'none'"]],
    ]);
    for (const [directive, expectedSources] of requiredDirectives) {
      if (JSON.stringify(policy.get(directive)) !== JSON.stringify(expectedSources)) {
        failures.add(`Content-Security-Policy must contain ${directive} ${expectedSources.join(" ")}.`);
      }
    }
    if (policy.size !== requiredDirectives.size || directiveCount !== requiredDirectives.size) failures.add("Content-Security-Policy contains an unexpected or duplicate directive.");

    const lowerHtml = html.toLowerCase();
    const cspPosition = html.indexOf(cspContent);
    const headClosePosition = lowerHtml.indexOf("</head>");
    const firstScriptPosition = lowerHtml.indexOf("<script");
    if (cspPosition === -1 || cspPosition > headClosePosition || (firstScriptPosition !== -1 && cspPosition > firstScriptPosition)) {
      failures.add("Content-Security-Policy must appear in <head> before every script.");
    }
  }

  const resourceAttributes = new Map([
    ["script", ["src"]],
    ["link", ["href"]],
    ["img", ["src", "srcset"]],
    ["source", ["src", "srcset"]],
    ["audio", ["src"]],
    ["video", ["src", "poster"]],
    ["track", ["src"]],
    ["iframe", ["src"]],
    ["embed", ["src"]],
    ["object", ["data"]],
    ["image", ["href", "xlink:href"]],
    ["use", ["href", "xlink:href"]],
  ]);
  const urlAttributes = new Set(["action", "cite", "data", "formaction", "href", "manifest", "poster", "src", "srcset", "xlink:href"]);

  for (const { name, attributes } of tags) {
    if (name === "meta" && attributes.get("http-equiv")?.toLowerCase() === "refresh") {
      failures.add("Meta refresh navigation is not allowed.");
    }

    for (const attribute of resourceAttributes.get(name) ?? []) {
      if (attributes.has(attribute) && !isAllowedEmbeddedResource(name, attribute, attributes.get(attribute))) {
        failures.add(`<${name}> ${attribute}=${JSON.stringify(attributes.get(attribute))} is not embedded`);
      }
    }

    if (attributes.has("srcdoc")) failures.add(`<${name}> srcdoc can embed executable content`);

    for (const [attribute, value] of attributes) {
      if (name === "a" && attribute === "href" && !decodeUrl(value).startsWith("#")) {
        failures.add(`<a> href=${JSON.stringify(value)} is not a local fragment`);
      }
      if (urlAttributes.has(attribute) && isNetworkUrl(value)) {
        failures.add(`<${name}> ${attribute}=${JSON.stringify(value)} is a network URL`);
      }
    }

    if (attributes.has("style")) css.push(attributes.get("style"));
  }

  for (const [index, stylesheet] of css.entries()) {
    for (const match of stylesheet.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gis)) {
      if (!isInlineUrl(match[2])) failures.add(`CSS block ${index + 1} url(${JSON.stringify(match[2])}) is not embedded`);
    }
    for (const match of stylesheet.matchAll(/@import\s+(?:url\(\s*)?["']?([^"'\s;)]+)/gi)) {
      if (!isInlineUrl(match[1])) failures.add(`CSS block ${index + 1} @import ${JSON.stringify(match[1])} loads another stylesheet`);
    }
  }

  const inertNetworkUrl = /^(?:https:\/\/react\.dev\/errors\/|http:\/\/www\.w3\.org\/)/i;
  for (const [index, script] of scripts.entries()) {
    for (const match of script.matchAll(/(?:https?|wss?|ftp):\/\/[^\s"'<>`]+/gi)) {
      if (!inertNetworkUrl.test(match[0])) {
        failures.add(`JavaScript block ${index + 1} contains network URL ${JSON.stringify(match[0])}`);
      }
    }

    const resourcePropertyPattern = /\b(?:src|srcset|href|poster|xlinkHref)\s*[:=]\s*(["'`])([^"'`]+)\1/gi;
    for (const match of script.matchAll(resourcePropertyPattern)) {
      if (!isInlineUrl(match[2])) {
        failures.add(`JavaScript block ${index + 1} runtime resource ${JSON.stringify(match[2])} is not embedded`);
      }
    }

    const networkCallPattern = /\b(?:fetch|EventSource|WebSocket|sendBeacon|import|Worker|SharedWorker)\s*\(\s*(["'`])([^"'`]+)\1/gi;
    for (const match of script.matchAll(networkCallPattern)) {
      if (!isInlineUrl(match[2])) {
        failures.add(`JavaScript block ${index + 1} network call uses ${JSON.stringify(match[2])}`);
      }
    }

    if (/(?:\b(?:window\.)?location(?:\.href)?\s*=(?!=)|\b(?:window\.)?location\.(?:assign|replace)\s*\(|\bwindow\.open\s*\()/i.test(script)) {
      failures.add(`JavaScript block ${index + 1} contains a navigation API`);
    }
  }

  return failures;
}

test("dist/index.html has no external runtime resources", () => {
  const failures = validateOfflineDocument(readFileSync(exportFile, "utf8"));
  assert.equal(failures.size, 0, `Offline export is not self-contained:\n${[...failures].map((failure) => `- ${failure}`).join("\n")}`);
});

test("offline validation fails closed for unsafe or malformed documents", () => {
  const csp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; media-src data:; object-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'; navigate-to 'none'";
  const baseline = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${csp}"><style>${"a".repeat(101)}</style></head><body><div id="root"></div><script>${"x".repeat(1_001)}</script></body></html>`;
  assert.equal(validateOfflineDocument(baseline).size, 0, "negative fixtures require a passing baseline");

  const fixtures = [
    ["empty document", "", "doctype"],
    ["unclosed document", baseline.replace("</html>", ""), "complete html/head/body"],
    ["executable data iframe", baseline.replace("</body>", "<iframe src=\"data:text/html,<script>alert(1)</script>\"></iframe></body>"), "<iframe> src"],
    ["executable data anchor", baseline.replace("</body>", "<a href=\"data:text/html,<script>alert(1)</script>\">open</a></body>"), "not a local fragment"],
    ["meta refresh", baseline.replace("</head>", "<meta http-equiv=\"refresh\" content=\"0;url=https://example.com\"></head>"), "Meta refresh"],
    ["literal network call", baseline.replace("<script>", "<script>fetch('https://example.com');"), "network call"],
    ["computed navigation", baseline.replace("<script>", "<script>location.href=['https:', '', 'example.com'].join('/');"), "navigation API"],
    ["duplicate CSP directive", baseline.replace(csp, `connect-src https:; ${csp}`), "unexpected or duplicate"],
  ];

  for (const [name, fixture, expectedFailure] of fixtures) {
    const failures = [...validateOfflineDocument(fixture)];
    assert.ok(failures.some((failure) => failure.includes(expectedFailure)), `${name} must be rejected for ${expectedFailure}; got ${failures.join(" | ")}`);
  }
});
