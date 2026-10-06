---
name: Learning Line
description: Shop-floor learning loop for TMMIN Karawang, styled like plant safety signage.
colors:
  ground: "#f2f2f2"
  surface: "#ffffff"
  panel: "#e8e8e8"
  line: "#d8d8d8"
  line-strong: "#a8a8a8"
  ink: "#252525"
  ink-2: "#333333"
  muted: "#6e6e6e"
  stop-red: "#eb0a1e"
  stop-red-hover: "#c10a16"
  caution-yellow: "#f2b705"
  safe-green: "#1a7a3d"
  safe-tint: "#e2f1e7"
  instruct-blue: "#0066b1"
  instruct-tint: "#e1edf8"
typography:
  plate:
    fontFamily: "Source Sans 3, Helvetica Neue, Arial, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Source Sans 3, Helvetica Neue, Arial, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "Source Sans 3, Helvetica Neue, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.2
  body-floor:
    fontFamily: "Source Sans 3, Helvetica Neue, Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  body-desk:
    fontFamily: "Source Sans 3, Helvetica Neue, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  label:
    fontFamily: "Source Sans 3, Helvetica Neue, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 700
  id-mono:
    fontFamily: "Source Code Pro, ui-monospace, Menlo, monospace"
    fontSize: "0.86em"
    fontWeight: 500
    letterSpacing: "-0.02em"
rounded:
  input: "4px"
  panel: "8px"
  pill: "999px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "24px"
  s6: "32px"
  s7: "48px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    height: "48px"
    padding: "0 24px"
  button-primary-xl:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    height: "72px"
    padding: "0 32px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "48px"
  button-stop:
    backgroundColor: "{colors.stop-red}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    height: "72px"
  plate-caution:
    backgroundColor: "{colors.caution-yellow}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
  plate-stop:
    backgroundColor: "{colors.stop-red}"
    textColor: "{colors.surface}"
    rounded: "{rounded.panel}"
  plate-safe:
    backgroundColor: "{colors.safe-green}"
    textColor: "{colors.surface}"
    rounded: "{rounded.panel}"
  plate-instruct:
    backgroundColor: "{colors.instruct-blue}"
    textColor: "{colors.surface}"
    rounded: "{rounded.panel}"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    padding: "24px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.input}"
    height: "48px"
    padding: "12px 14px"
---

# Design System: Learning Line

Reference build: `design/mockup/` (open `design/mockup/index.html`). Product truth: `PRODUCT.md`.

## Overview

**Creative North Star: "The Plant Sign"**

Learning Line reads like the safety signage of a Japanese car plant. The ground is a calm neutral grey, as ISA-101 recommends for industrial screens. Colour appears only when something is abnormal or final, and each colour keeps the meaning it has on a plant sign: red stop, yellow caution, green safe or validated, blue instruction or standard. The result should feel like a Toyota tool: precise, plain, unhurried. It must not look like a marketing site or a generic SaaS dashboard.

Density follows the user. Operator and team-leader screens are large and sparse: one decision at a time, with targets usable in gloves. Engineer and management screens pack ruled modules and tables more tightly. One visual grammar holds across both.

The visual language takes inspiration from Toyota but is not Toyota branding. There is no Toyota emblem, no Toyota Type, and nothing that suggests an official Toyota product.

**Key Characteristics:**
- Neutral grey ground, white work surfaces, charcoal ink.
- Safety colours carry state and nothing else.
- The sign plate is the signature component.
- Pill buttons, 8 px panels, ruled tables, tabular numerals.
- A five-step abnormality trail ties the screens into one story.

## Colors

Restrained neutrals with four signal colours that are never decorative.

### Primary
- **Charcoal Ink** (#252525): primary buttons, headings, selected tabs, the current trail step, chart lines.

### Signal (state only)
- **Stop Red** (#eb0a1e): the thin brand strip at the top of every screen, the "Stop and fix" action and plate, and the leak-critical badge. Nowhere else.
- **Caution Yellow** (#f2b705): yellow andon, pending operator or team-leader decisions, the defect heatmap. Always paired with ink text.
- **Safe Green** (#1a7a3d): validated knowledge cards and confirmed fixes. Darkened from Toyota's #1f8b46 so white text passes AA.
- **Instruct Blue** (#0066b1): instructions and standards, such as model review needed, draft cards awaiting validation, links and the focus ring.

### Neutral
- **Plant Grey** (#f2f2f2): page ground and quieted elements.
- **White** (#ffffff): panels, plates, inputs.
- **Panel Grey** (#e8e8e8): neutral badges and the selected-row background.
- **Rule** (#d8d8d8) and **Rule Strong** (#a8a8a8): hairlines, input borders, inactive trail rings.
- **Muted** (#6e6e6e): secondary text. It passes AA on both white and Plant Grey.

### Named Rules
**The Sign Rule.** A colour on screen means what it means on a plant sign. If nothing is abnormal, pending or final, the screen is grey and ink.

**The One Red Rule.** Toyota Red is used for the brand strip, stop and leak-critical only. No red primary buttons, no red links, no red focus.

**The No Category Colour Rule.** Loops and categories never take a signal colour. Loops are marked with neutral letter tags (S, K, L).

## Typography

**Body Font:** Source Sans 3 (400, 600, 700) with Helvetica Neue, Arial
**Mono Font:** Source Code Pro (500), used only for IDs: bodies, regions, cards, tickets, model versions.

**Character:** A plain, legible gothic sans in the spirit of Toyota's humanist-technical lettering, which is proprietary and not used. Mono marks machine identifiers, never decoration.

### Hierarchy
- **Plate** (700, 26 px, 22 px on phone, line-height 1.1): sign plate titles. Always the loudest text on the screen.
- **Headline** (700, 28 px, 24 px on phone): page titles.
- **Title** (700, 17 px): panel headings.
- **Body, floor** (400, 18 px): operator and team-leader screens. Buttons are 20 px; key numbers are 32–40 px.
- **Body, desk** (400, 15 px): engineer, senior expert and management screens.
- **Label** (700, 13 px): badges and table headers. Sentence case; no eyebrows above headings.

### Named Rules
**The Tabular Rule.** Every number uses tabular figures and aligns to its column.

## Layout

- Container max width is 1440 px with 24 px gutters (16 px on phone). Spacing follows an 8 px rhythm: 4, 8, 12, 16, 24, 32, 48.
- Shell: sticky top bar with a 4 px red strip, product name, screen tabs, role switcher and shift clock. The abnormality trail sits under it. Every page ends with the footer "Concept prototype · simulated data · not connected to TMMIN systems".
- Breakpoints:
  - Phone (< 768 px): tabs move to a bottom tab bar, the trail shows icons plus the current label, and every grid becomes one column.
  - Tablet (768–1100 px): tab labels collapse to icons.
  - Desktop (≥ 1100 px): full layout.
- Station: image about 60% on the left, decision column on the right. On phone the decision comes straight after the image.
- When a decision is pending, the rest of the screen quiets: unflagged tiles drop to the grey ground with full-contrast text. Opacity is never used for this.

## Elevation & Depth

The screens are flat by default. Panels separate by hairlines and white on grey. Two neutral shadows exist:
- **Plate** (`0 1px 2px rgba(0,0,0,.06), 0 2px 6px rgba(0,0,0,.05)`): sign plates and the station image.
- **Overlay** (`0 8px 24px rgba(0,0,0,.14)`): sheets and toasts.

## Shapes

- Interactive elements (buttons, badges, chips, the role switcher) are full pills.
- Panels and plates use 8 px corners. Inputs use 4 px.
- Tables have no radius and use horizontal rules only: a 2 px ink header rule and 1 px row rules.

## Components

### Sign Plate (signature)
- A solid colour band holds a square pictogram tile and the state in plain words ("Caution: bead break", "Validated: safe to reuse"). The facts sit below on white.
- Caution and stop bands carry an 8 px hazard-stripe edge.
- Use a plate only where a decision is pending or a state is final. Never use one as a generic card.

### Buttons
- **Primary:** charcoal pill, white 16 px bold text, 48 px tall. On floor screens it is 72 px, 20 px text and full width.
- **Ghost:** transparent with a 2 px ink border. On hover it fills with ink.
- **Stop:** red pill, used only for "Stop and fix".
- **Press:** `scale(.97)` over 160 ms with `cubic-bezier(.23,1,.32,1)`. Hover effects only apply on devices with a fine pointer.

### Chips and Badges
- Reason codes and filters are pill radios: white with a rule border, ink fill when selected. They are 60 px tall on floor sheets.
- Badges come in four variants:
  - Leak-critical: red.
  - Yellow andon: yellow.
  - Validated: green on a green tint.
  - Model review: blue on a blue tint.
- The AI-drafted badge uses a dashed blue outline.

### Panels and Tables
- White panels with a 1 px rule border and 8 px corners; the head is separated by a rule.
- In tables, the selected row is Panel Grey with semibold text.

### Inputs
- White with a 1 px Rule Strong border, 48 px tall and 4 px radius.
- On focus the border turns blue with a 3 px blue-tint ring. The label always sits above the input.

### Abnormality Trail
- Five steps: Detected, Operator, Team leader, Kaizen ticket, Validated card.
- Done steps show an ink dot with a check. The current step shows an ink ring, or yellow when an operator or team leader decision is pending.

### Sheets
- Native `<dialog>`. On phone it is a bottom sheet (drawer curve `cubic-bezier(.32,.72,0,1)`); on desktop it is a centred card. Entry uses `@starting-style`.

## Do's and Don'ts

### Do:
- **Do** keep every screen grey and ink until something is abnormal, pending or final.
- **Do** label every simulated image and number as simulated.
- **Do** show who decided ("Decided by team leader · role:team-leader@body") after every human action.
- **Do** keep operator and team-leader targets at 48 px or more, and primary actions at 72 px.
- **Do** respect `prefers-reduced-motion`; motion is limited to state changes of 150–250 ms.

### Don't:
- **Don't** use Toyota Red for anything except the brand strip, stop and leak-critical.
- **Don't** colour loops, categories, selections or progress with signal colours.
- **Don't** fade content with opacity to de-emphasise it.
- **Don't** use KPI-card rows (a big number over a small label). Put metrics in ruled tables.
- **Don't** add eyebrows or kickers above headings, gradients (except the functional heatmap and hazard stripe), glass, or em-dashes.
- **Don't** use the Toyota emblem, Toyota Type, faces or personal names.
