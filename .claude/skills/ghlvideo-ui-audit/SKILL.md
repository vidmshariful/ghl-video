---
name: ghlvideo-ui-audit
description: Run mechanical accessibility and design-system checks against a live page in the Browser pane, and report what is actually broken with the element that broke it. Use after building or restyling any screen on this repo, or when asked to "check accessibility", "audit this screen", "is this responsive", "check contrast", or before calling UI work done.
---

# UI audit, run against the live page

Checks a real rendered page rather than reading source, because most of these
faults only exist after CSS and JS have run. Everything here uses the Browser
pane tools already available; there is no external scanner to install.

The rule: **locate, report, then fix the source file.** Never fix by injecting
JS into the page.

## Setup

1. `preview_start` with `{name: "ghl-video-dev"}` (or `{url}` for production).
2. `navigate` to the page.
3. Portals and checkout need a signed-in session; see the QA account pattern in
   the session history rather than creating accounts casually.

## Pass 1: the accessibility tree

`read_page` returns the tree the screen reader sees. Read it first and ask:

- Does every interactive element have a name? An entry like `button [ref_12]`
  with no label is a control nobody can announce or describe.
- Do the headings descend in order, with exactly one top-level heading?
- Are icon-only buttons carrying `aria-label`?

This one pass catches most naming faults faster than any script.

## Pass 2: the mechanical checks

Run with `javascript_tool`. Returns a compact report; each finding names the
element so it can be traced back to source.

Take a `screenshot` first. Until the pane has rendered once, `window.innerWidth`
is 0 and every width-based check returns nonsense.

```js
(() => {
  const vw = window.innerWidth;
  if (!vw) return { note: "viewport not measured yet, take a screenshot first" };
  const out = { viewport: vw };
  const sel = (el) => el.tagName.toLowerCase() +
    (el.id ? "#" + el.id : "") +
    (el.className && typeof el.className === "string"
      ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "");

  // images with no alt attribute at all (alt="" is a valid decorative choice)
  out.imagesNoAlt = [...document.images]
    .filter((i) => !i.hasAttribute("alt"))
    .map((i) => i.currentSrc || i.src).slice(0, 10);

  // controls with no accessible name
  out.unnamedControls = [...document.querySelectorAll(
    'button,a[href],input:not([type=hidden]),select,textarea')]
    .filter((el) => {
      const name = (el.getAttribute("aria-label") || el.textContent || "").trim()
        || (el.labels && el.labels.length) || el.getAttribute("title");
      return !name;
    }).map(sel).slice(0, 10);

  // tap targets under 44px (WCAG 2.2 target size)
  out.smallTargets = [...document.querySelectorAll('button,a[href],input,select')]
    .filter((el) => { const r = el.getBoundingClientRect();
      return r.width > 0 && (r.width < 44 || r.height < 44); })
    .map((el) => { const r = el.getBoundingClientRect();
      return `${sel(el)} ${Math.round(r.width)}x${Math.round(r.height)}`; }).slice(0, 10);

  // form fields with no label
  out.unlabelledFields = [...document.querySelectorAll('input:not([type=hidden]),select,textarea')]
    .filter((el) => !(el.labels && el.labels.length) && !el.getAttribute("aria-label"))
    .map(sel).slice(0, 10);

  // page must never scroll sideways
  out.horizontalOverflow = document.documentElement.scrollWidth > vw
    ? `page is ${document.documentElement.scrollWidth}px wide in a ${vw}px viewport`
    : "none";

  // the widest offenders, when there IS overflow
  if (out.horizontalOverflow !== "none") {
    out.overflowingElements = [...document.querySelectorAll("*")]
      .filter((el) => el.getBoundingClientRect().right > vw + 1)
      .map(sel).slice(0, 8);
  }

  // design-system violations: radii outside the locked set, WITH the element
  // that owns each one so it can be traced to source. rounded-full computes to
  // a huge pixel value rather than 9999px, so treat anything past 999 as full.
  const okRadius = (v) => {
    const n = parseFloat(v);
    return v === "50%" || (!Number.isNaN(n) && (n === 0 || n === 3 || n === 4 ||
      n === 8 || n === 12 || n > 999));
  };
  const owners = {};
  for (const el of document.querySelectorAll("*")) {
    const r = getComputedStyle(el).borderRadius;
    if (r && r !== "0px" && !r.split(" ").every(okRadius)) (owners[r] ||= []).push(sel(el));
  }
  out.strayRadii = Object.fromEntries(
    Object.entries(owners).slice(0, 6).map(([k, v]) => [k, v.slice(0, 3)]));

  return out;
})()
```

Verified against `/premade/` while writing this: it correctly returns no unnamed
controls, no missing alt, no overflow, and surfaces the two genuine stray radii
(2px and 6px) on that page with the elements that carry them.

Read the result honestly. `smallTargets` will list some legitimately small
inline links; judge them rather than reporting the raw count.

## Pass 3: contrast

Text must clear WCAG AA: 4.5:1 for body, 3:1 for large text (24px+, or 19px+
bold). The dim grey on canvas was tuned to pass; a new colour pairing has not
been.

```js
(() => {
  const lum = (c) => { const [r,g,b] = c.match(/\d+/g).map(Number).map((v) => {
      v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
    return 0.2126*r + 0.7152*g + 0.0722*b; };
  const ratio = (a, b) => { const [x,y] = [lum(a), lum(b)].sort((m,n) => n-m);
    return (x + 0.05) / (y + 0.05); };
  const bgOf = (el) => { let n = el;
    while (n && n !== document.documentElement) {
      const bg = getComputedStyle(n).backgroundColor;
      if (bg && !bg.includes("rgba(0, 0, 0, 0)")) return bg;
      n = n.parentElement; }
    return getComputedStyle(document.body).backgroundColor; };
  return [...document.querySelectorAll("p,span,a,li,h1,h2,h3,h4,button,td,th,label")]
    .filter((el) => el.textContent.trim() && el.offsetParent !== null)
    .map((el) => { const s = getComputedStyle(el);
      const size = parseFloat(s.fontSize);
      const large = size >= 24 || (size >= 19 && parseInt(s.fontWeight) >= 700);
      const r = ratio(s.color, bgOf(el));
      return { text: el.textContent.trim().slice(0, 40), ratio: +r.toFixed(2),
               need: large ? 3 : 4.5, size: Math.round(size) }; })
    .filter((x) => x.ratio < x.need)
    .slice(0, 12);
})()
```

## Pass 4: responsive and motion

- `resize_window` to `mobile` (375px), reload, repeat pass 2. Layout faults are
  usually mobile-only.
- Then narrow to 320px and confirm nothing overflows. The floor is 320.
- `resize_window` with `colorScheme` both ways for surfaces that theme.
- Confirm reduced motion is respected:
  ```js
  matchMedia("(prefers-reduced-motion: reduce)").matches
  ```
  and that animation is gated on it in source.

## Pass 5: keyboard

Tab through the primary flow with `computer` key presses. Focus must be visible
at every stop, order must follow the visual layout, and nothing may trap focus.
Modals must return focus to the trigger on close.

## Reporting

Say what is broken, where, and what it costs the user. Do not report a raw
violation count as if it were a score. Separate:

- **broken** (a control nobody can name, text under contrast, sideways scroll)
- **worth fixing** (small tap target, heading order)
- **fine on purpose** (`alt=""` on decorative art, a deliberately compact inline link)

Then fix the source files and re-run the same passes to prove it.
