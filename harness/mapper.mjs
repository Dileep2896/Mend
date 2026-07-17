// Mend — source mapper. Given an axe violation node (CSS target + rendered HTML
// snippet) and the source route it came from, locate the producing source
// file + line range.
//
// Strategy (TASKS.md M1, in order):
//   1. stable attributes: id, name, href, aria-*, alt, title, data-*, literal text
//   2. structural match: tag name + class list + attribute overlap, scored
//   3. (build-time data-mend-src annotation — not needed for static HTML target)
//
// The target is static HTML, so the served file for a route IS the source file.
// The rendered snippet still differs from source bytes (attribute reordering,
// quote normalization, self-closing rewrites, axe truncation), so we score a
// match and always expand the hit to the element's full opening tag.
//
// export mapViolationNode({ routeFile, nodeHtml, target }) ->
//   { file, lineStart, lineEnd, confidence, strategy, matchedOn } | { blocked, reason }

import { readFileSync } from "node:fs";

// Document/structural tags whose location is the tag itself (landmark/region rules).
const STRUCTURAL_TAGS = new Set(["html", "body", "main", "header", "footer", "nav", "aside", "section"]);
// Stable, high-signal attributes in descending discriminating power.
const STABLE = ["id", "name", "href", "for", "aria-label", "alt", "title", "value", "placeholder", "type", "role"];

function openingTag(html) {
  const m = html.match(/<([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)\/?>/);
  if (!m) return null;
  return { tag: m[1].toLowerCase(), attrsRaw: m[2], full: m[0] };
}

function parseAttrs(attrsRaw) {
  const attrs = {};
  const re = /([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)'|(\S+))/g;
  let m;
  while ((m = re.exec(attrsRaw))) attrs[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? "";
  return attrs;
}

// Trailing/child text of the failing element — handles axe truncation (may have
// no closing "<"). Returns a short signal string or null.
function snippetText(html) {
  const between = html.match(/>([^<>]{3,80})</); // fully enclosed text
  if (between) return between[1].trim();
  const trailing = html.match(/>([^<>]{3,80})\s*$/); // truncated tail
  if (trailing) return trailing[1].trim();
  return null;
}

const wordTagRe = (tag) => new RegExp(`<${tag}(?=[\\s>/]|$)`, "i");

// From a hit line, expand up to the element's "<tag" open and down to its ">".
function expandToTag(lines, hitIdx, tag, maxUp = 10) {
  let start = hitIdx;
  const re = wordTagRe(tag);
  for (let k = hitIdx; k >= Math.max(0, hitIdx - maxUp); k--) {
    if (re.test(lines[k])) { start = k; break; }
  }
  let end = start;
  while (end < lines.length - 1 && !lines[end].includes(">")) end++;
  // if the hit line was below the close (text child), keep it in range
  if (hitIdx > end) end = hitIdx;
  return { start, end };
}

export function mapViolationNode({ routeFile, nodeHtml, target }) {
  const src = readFileSync(routeFile, "utf8");
  const lines = src.split("\n");
  const open = openingTag(nodeHtml);
  if (!open) return { blocked: true, reason: "could not parse opening tag from snippet" };
  const attrs = parseAttrs(open.attrsRaw);
  const classes = (attrs.class ?? "").split(/\s+/).filter(Boolean);

  const locate = (idx, strategy, matchedOn, conf) => {
    const { start, end } = expandToTag(lines, idx, open.tag);
    return { file: routeFile, lineStart: start + 1, lineEnd: end + 1, confidence: conf, strategy, matchedOn };
  };

  // ---- Strategy 1: a unique stable-attribute value.
  for (const key of STABLE) {
    const val = attrs[key];
    if (!val) continue;
    const hits = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(`${key}="${val}"`) || lines[i].includes(`${key}='${val}'`)) hits.push(i);
    }
    if (hits.length === 1) return locate(hits[0], "stable-attr", `${key}=${val}`, 0.98);
  }

  // ---- Strategy 1b: structural/document tag — locate the tag itself if unique.
  if (STRUCTURAL_TAGS.has(open.tag)) {
    const hits = [];
    for (let i = 0; i < lines.length; i++) if (wordTagRe(open.tag).test(lines[i])) hits.push(i);
    if (hits.length === 1) return locate(hits[0], "structural-tag", `<${open.tag}>`, 0.9);
    if (hits.length > 1 && classes.length) {
      const narrowed = hits.filter((i) => classes.every((c) => lines[i].includes(c)));
      if (narrowed.length === 1) return locate(narrowed[0], "structural-tag", `<${open.tag}> .${classes.join(".")}`, 0.85);
    }
  }

  // ---- Strategy 1c: unique literal text (link/button/cell content).
  const text = snippetText(nodeHtml);
  if (text) {
    const hits = [];
    for (let i = 0; i < lines.length; i++) if (lines[i].includes(text)) hits.push(i);
    if (hits.length === 1) return locate(hits[0], "literal-text", text.slice(0, 40), 0.9);
  }

  // ---- Strategy 2: structural scoring over every opening tag of same name.
  const re = wordTagRe(open.tag);
  let best = null;
  for (let i = 0; i < lines.length; i++) {
    if (!re.test(lines[i])) continue;
    let chunk = lines[i].slice(lines[i].toLowerCase().indexOf(`<${open.tag}`));
    let j = i;
    while (!chunk.includes(">") && j < lines.length - 1) chunk += " " + lines[++j];
    const srcOpen = openingTag(chunk);
    if (!srcOpen) continue;
    const srcAttrs = parseAttrs(srcOpen.attrsRaw);
    const srcClasses = (srcAttrs.class ?? "").split(/\s+/).filter(Boolean);

    let score = 0;
    const matchedOn = [];
    for (const key of STABLE) {
      if (attrs[key] && srcAttrs[key] === attrs[key]) { score += 5; matchedOn.push(`${key}=${attrs[key]}`); }
    }
    if (classes.length) {
      const overlap = classes.filter((c) => srcClasses.includes(c)).length;
      const frac = overlap / classes.length;
      score += frac * 4;
      // penalise source elements carrying many extra classes (loose match)
      if (srcClasses.length > classes.length) score -= 0.3 * (srcClasses.length - classes.length);
      if (frac === 1) matchedOn.push(`class:${classes.join(".")}`);
    }
    // child-text corroboration
    if (text && lines.slice(i, Math.min(lines.length, j + 4)).some((l) => l.includes(text))) {
      score += 3;
      matchedOn.push(`text:${text.slice(0, 24)}`);
    }
    score += 0.01 * Object.keys(srcAttrs).filter((k) => k in attrs).length;

    if (score > 0 && (!best || score > best.score || (score === best.score && j - i < best.span))) {
      best = { i, j, score, matchedOn, span: j - i };
    }
  }

  if (best && best.score >= 4) {
    return {
      file: routeFile,
      lineStart: best.i + 1,
      lineEnd: best.j + 1,
      confidence: Number(Math.min(0.95, 0.4 + best.score / 20).toFixed(2)),
      strategy: "structural",
      matchedOn: best.matchedOn,
    };
  }
  return { blocked: true, reason: `no confident match (best score ${best?.score?.toFixed(2) ?? 0})` };
}
