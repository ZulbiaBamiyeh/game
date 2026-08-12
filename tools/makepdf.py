#!/usr/bin/env python3
"""Render docs/DESIGN.md to a styled PDF using the sandbox's pinned Chromium.

Deliberately a small hand-rolled Markdown subset rather than a dependency: the
document is the only input, and it uses headings, tables, lists, fences, rules,
blockquotes, bold, italic and inline code. Nothing else.
"""
import html
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "docs", "DESIGN.md")
OUT = os.path.join(ROOT, "docs", "Site7-Deep-Survey-Design.pdf")

CHROME_CANDIDATES = [
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    "/opt/pw-browsers/chromium/chrome-linux/chrome",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
]

CSS = """
@page { size: A4; margin: 17mm 15mm 16mm; }
:root{
  --ink:#231d12; --ink-2:#5c5343; --ink-3:#8a806c;
  --ochre:#8a6a2c; --rule:#d8d0bd; --panel:#f6f2e7; --bg:#fffdf7;
}
*{box-sizing:border-box}
body{
  margin:0; background:var(--bg); color:var(--ink);
  font:11pt/1.62 "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
.doc{max-width:172mm;margin:0 auto}

h1{
  font-size:27pt;line-height:1.1;margin:0 0 2mm;letter-spacing:-0.01em;
  font-weight:600;
}
.sub{
  font:italic 12pt/1.5 Georgia,serif;color:var(--ink-2);
  margin:0 0 3mm;padding-bottom:5mm;border-bottom:2px solid var(--ochre);
}
h2{
  font-size:14pt;margin:11mm 0 3mm;padding-bottom:1.5mm;font-weight:600;
  border-bottom:1px solid var(--rule);
  page-break-after:avoid;
}
h3{font-size:11.5pt;margin:6mm 0 2mm;font-weight:600;color:var(--ochre);page-break-after:avoid}
p{margin:0 0 3.2mm}
strong{font-weight:600}
hr{border:none;border-top:1px solid var(--rule);margin:8mm 0}

ul,ol{margin:0 0 3.5mm;padding-left:6mm}
li{margin-bottom:1.4mm}

blockquote{
  margin:4mm 0;padding:3mm 5mm;background:var(--panel);
  border-left:3px solid var(--ochre);font-style:italic;color:var(--ink-2);
}
blockquote strong{color:var(--ink);font-style:normal}

code{
  font:10pt/1.4 "SF Mono",Menlo,Consolas,monospace;
  background:var(--panel);padding:0.5mm 1.2mm;border-radius:1.5px;
  color:#5a4520;
}
pre{
  background:var(--panel);border:1px solid var(--rule);border-left:3px solid var(--ochre);
  padding:3mm 4mm;margin:0 0 4mm;overflow:hidden;page-break-inside:avoid;
}
pre code{background:none;padding:0;font-size:8.6pt;line-height:1.45;color:var(--ink)}

table{
  width:100%;border-collapse:collapse;margin:0 0 5mm;
  font-size:9.4pt;page-break-inside:avoid;
}
th{
  text-align:left;font-weight:600;font-size:8pt;letter-spacing:.09em;
  text-transform:uppercase;color:var(--ochre);
  border-bottom:1.2px solid var(--ochre);padding:1.6mm 2.4mm 1.4mm;
}
td{border-bottom:1px solid var(--rule);padding:1.5mm 2.4mm;vertical-align:top}
tr:nth-child(even) td{background:#faf7ee}

.foot{
  margin-top:10mm;padding-top:3mm;border-top:1px solid var(--rule);
  font-size:8.5pt;color:var(--ink-3);
}
"""

INLINE = [
    (re.compile(r"`([^`]+)`"), lambda m: "<code>" + html.escape(m.group(1)) + "</code>"),
    (re.compile(r"\*\*([^*]+)\*\*"), r"<strong>\1</strong>"),
    (re.compile(r"(?<![\w*])\*([^*\n]+)\*(?![\w*])"), r"<em>\1</em>"),
]


def inline(text, escape=True):
    if escape:
        text = html.escape(text)
    # code spans first, so their contents are not touched by the emphasis rules
    parts, last = [], 0
    for m in INLINE[0][0].finditer(text):
        parts.append((text[last:m.start()], False))
        parts.append(("<code>" + m.group(1) + "</code>", True))
        last = m.end()
    parts.append((text[last:], False))
    out = []
    for chunk, is_code in parts:
        if not is_code:
            for pattern, repl in INLINE[1:]:
                chunk = pattern.sub(repl, chunk)
        out.append(chunk)
    return "".join(out)


def cells(row):
    row = row.strip()
    if row.startswith("|"):
        row = row[1:]
    if row.endswith("|"):
        row = row[:-1]
    return [c.strip() for c in row.split("|")]


def convert(md):
    lines = md.split("\n")
    out, i = [], 0
    while i < len(lines):
        line = lines[i]

        if line.startswith("```"):
            i += 1
            block = []
            while i < len(lines) and not lines[i].startswith("```"):
                block.append(lines[i])
                i += 1
            i += 1
            out.append("<pre><code>" + html.escape("\n".join(block)) + "</code></pre>")
            continue

        if line.startswith("|") and i + 1 < len(lines) and re.match(r"^\|[\s:|-]+\|?$", lines[i + 1]):
            head = cells(line)
            i += 2
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                rows.append(cells(lines[i]))
                i += 1
            out.append("<table><thead><tr>" +
                       "".join("<th>" + inline(c) + "</th>" for c in head) +
                       "</tr></thead><tbody>" +
                       "".join("<tr>" + "".join("<td>" + inline(c) + "</td>" for c in r) + "</tr>"
                               for r in rows) +
                       "</tbody></table>")
            continue

        if line.startswith("> "):
            block = []
            while i < len(lines) and lines[i].startswith(">"):
                block.append(lines[i].lstrip("> ").rstrip())
                i += 1
            out.append("<blockquote>" + inline(" ".join(block)) + "</blockquote>")
            continue

        m = re.match(r"^(#{1,4})\s+(.*)$", line)
        if m:
            level = len(m.group(1))
            out.append("<h%d>%s</h%d>" % (level, inline(m.group(2)), level))
            i += 1
            continue

        if re.match(r"^---+\s*$", line):
            out.append("<hr>")
            i += 1
            continue

        if re.match(r"^\s*[-*]\s+", line) or re.match(r"^\s*\d+\.\s+", line):
            ordered = bool(re.match(r"^\s*\d+\.\s+", line))
            items = []
            while i < len(lines) and (re.match(r"^\s*[-*]\s+", lines[i]) or
                                      re.match(r"^\s*\d+\.\s+", lines[i]) or
                                      (items and lines[i].startswith("   ") and lines[i].strip())):
                if re.match(r"^\s*([-*]|\d+\.)\s+", lines[i]):
                    items.append(re.sub(r"^\s*([-*]|\d+\.)\s+", "", lines[i]).rstrip())
                else:
                    items[-1] += " " + lines[i].strip()
                i += 1
            tag = "ol" if ordered else "ul"
            out.append("<%s>%s</%s>" % (tag, "".join("<li>" + inline(x) + "</li>" for x in items), tag))
            continue

        if not line.strip():
            i += 1
            continue

        para = []
        while i < len(lines) and lines[i].strip() and not re.match(
                r"^(#{1,4}\s|\||>|```|---+\s*$|\s*[-*]\s|\s*\d+\.\s)", lines[i]):
            para.append(lines[i].strip())
            i += 1
        out.append("<p>" + inline(" ".join(para)) + "</p>")

    return "\n".join(out)


def main():
    with open(SRC, encoding="utf-8") as fh:
        md = fh.read()

    # The first heading and the paragraph under it become the title block.
    body = convert(md)
    body = body.replace(
        "<p><strong>An idle excavation-and-museum game.</strong>",
        '<p class="lede"><strong>An idle excavation-and-museum game.</strong>', 1)

    page = ("<!DOCTYPE html><html><head><meta charset='utf-8'>"
            "<title>Site 7 — Deep Survey — Game Design</title>"
            "<style>" + CSS + "</style></head><body><div class='doc'>"
            + body +
            "<p class='foot'>Site 7 &mdash; Deep Survey &middot; game design document &middot; "
            "generated from <code>docs/DESIGN.md</code></p>"
            "</div></body></html>")

    chrome = next((c for c in CHROME_CANDIDATES if os.path.exists(c)), None)
    if not chrome:
        sys.exit("no Chromium found; looked in " + ", ".join(CHROME_CANDIDATES))

    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, "design.html")
        with open(src, "w", encoding="utf-8") as fh:
            fh.write(page)
        subprocess.run([
            chrome, "--headless", "--disable-gpu", "--no-sandbox",
            "--no-pdf-header-footer",
            "--print-to-pdf=" + OUT,
            "--virtual-time-budget=6000",
            "file://" + src,
        ], check=True, capture_output=True)

    print("wrote", OUT, os.path.getsize(OUT), "bytes")


if __name__ == "__main__":
    main()
