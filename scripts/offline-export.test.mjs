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
      cursor = end === -1 ? html.length : end + 3;
      continue;
    }

    const nameMatch = html.slice(start + 1).match(/^([a-z][\w:-]*)\b/i);
    if (!nameMatch) {
      cursor = start + 1;
      continue;
    }

    const end = readOpeningTag(html, start + 1);
    if (end === -1) break;

    const name = nameMatch[1].toLowerCase();
    const attributesSource = html.slice(start + 1 + nameMatch[0].length, end);
    tags.push({ name, attributes: parseAttributes(attributesSource) });
    cursor = end + 1;

    if (name === "script" || name === "style") {
      const closingTag = `</${name}`;
      const closeStart = lowerHtml.indexOf(closingTag, cursor);
      if (closeStart === -1) break;
      const contents = html.slice(cursor, closeStart);
      if (name === "style") css.push(contents);
      if (name === "script") scripts.push(contents);
      const closeEnd = html.indexOf(">", closeStart + closingTag.length);
      cursor = closeEnd === -1 ? html.length : closeEnd + 1;
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

test("dist/index.html is the only production artifact", () => {
  assert.deepEqual(
    readdirSync(distDirectory).sort(),
    ["index.html"],
    "Expected dist to contain only the standalone dist/index.html artifact. Run `npm run build` first.",
  );
  assert.equal(statSync(exportFile).isFile(), true, "Expected dist/index.html to be a regular file.");
});

test("dist/index.html has no external runtime resources", () => {
  const html = readFileSync(exportFile, "utf8");
  const { tags, css, scripts } = inspectMarkup(html);
  const failures = new Set();
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
    for (const attribute of resourceAttributes.get(name) ?? []) {
      if (attributes.has(attribute) && !isInlineUrl(attributes.get(attribute))) {
        failures.add(`<${name}> ${attribute}=${JSON.stringify(attributes.get(attribute))} is not embedded`);
      }
    }

    for (const [attribute, value] of attributes) {
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

    const networkCallPattern = /\b(?:fetch|EventSource|WebSocket|sendBeacon)\s*\(\s*(["'`])([^"'`]+)\1/gi;
    for (const match of script.matchAll(networkCallPattern)) {
      if (!isInlineUrl(match[2])) {
        failures.add(`JavaScript block ${index + 1} network call uses ${JSON.stringify(match[2])}`);
      }
    }
  }

  assert.equal(
    failures.size,
    0,
    `Offline export references external runtime resources:\n${[...failures].map((failure) => `- ${failure}`).join("\n")}`,
  );
});
