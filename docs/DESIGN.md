---
name: Learning Line
description: Shop-floor learning loop for TMMIN Karawang, styled like plant safety signage.
colors:
  ground: "rgba(255, 255, 255, .42)"
  surface: "rgba(255, 255, 255, .52)"
  surface-strong: "rgba(255, 255, 255, .86)"
  panel: "rgba(37, 37, 37, .07)"
  line: "rgba(37, 37, 37, .11)"
  line-strong: "rgba(37, 37, 37, .30)"
  glass-edge: "rgba(255, 255, 255, .75)"
  silver-light: "#ffffff"
  silver-mid: "#d6d6d6"
  silver-deep: "#d1d1d1"
  base-silver: "#ececec"
  ink: "#252525"
  ink-2: "#333333"
  muted: "#6e6e6e"
  muted-strong: "#5f5f5f"
  on-video-ground: "#1b1b1b"
  media-ground: "#3a3a3a"
  on-video-bar: "rgba(20, 20, 20, .22)"
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
  id:
    fontFamily: "Source Sans 3, Helvetica Neue, Arial, sans-serif"
    fontWeight: 600
    letterSpacing: "0.01em"
    fontFeature: "tnum"
rounded:
  input: "4px"
  tile: "6px"
  panel: "8px"
  feature: "16px"
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

Reference build: the app itself; design studies live in `design/mockup/` (hub: `design/mockup/plan.html`). Product truth: `PRODUCT.md`. Asset credits: `design/ASSETS.md`.

## Overview

**Creative North Star: "The Plant Sign"**

Learning Line reads like the safety signage of a Japanese car plant, set on frosted glass. A monochrome silver gradient (white highlights and soft grey shadows, no hue) lies under translucent glass panels, so the screens stay clean and calm and colour belongs only to state. Colour appears only when something is abnormal or final, and each colour keeps the meaning it has on a plant sign: red stop, yellow caution, green safe or validated, blue instruction or standard. The result should feel like a Toyota tool: precise, plain, unhurried. It must not look like a marketing site or a generic SaaS dashboard.

Density follows the user. Operator and team-leader screens are large and sparse: one decision at a time, with targets usable in gloves. Engineer and management screens pack ruled modules and tables more tightly. One visual grammar holds across both.

The visual language takes inspiration from Toyota but is not Toyota branding. There is no Toyota emblem, no Toyota Type, and nothing that suggests an official Toyota product.

**Key Characteristics:**
- Monochrome silver gradient ground, frosted glass panels, charcoal ink.
- Safety colours carry state and nothing else.
- The sign plate is the signature component.
- Gradient pill buttons, 8 px glass panels, ruled tables, tabular numerals.
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

### Ground and glass
- **Silver gradient**: monochrome radial washes of white (#ffffff, #f4f4f4) and grey (#d6d6d6, #d1d1d1) over a base linear gradient (#ececec to #e0e0e0). No hue in the background, ever. It is painted on a fixed layer behind the page.
- **Glass** (white at 52%): panels, plates, tiles and inputs. Uses `backdrop-filter: blur(22px) saturate(180%)`, a 1 px white edge at 75% and an inner top highlight.
- **Strong glass** (white at 86%): sheets and dialogs.
- **Panel tint** (ink at 7%): neutral badges and the selected-row background.
- **Rule** (ink at 11%) and **Rule Strong** (ink at 30%): hairlines, input borders, inactive trail rings.
- With `prefers-reduced-transparency`, the glass falls back to solid white.
- **Muted** (#6e6e6e): secondary text. It passes AA on both white and Plant Grey.

### Named Rules
**The Sign Rule.** A colour on screen means what it means on a plant sign. If nothing is abnormal, pending or final, the screen is grey and ink.

**The One Red Rule.** Toyota Red is used for the brand strip, stop and leak-critical only. No red primary buttons, no red links, no red focus.

**The No Category Colour Rule.** Loops and categories never take a signal colour. Loops are marked with neutral letter tags (S, K, L).

## Typography

**Font:** Source Sans 3 (400, 600, 700) with Helvetica Neue, Arial, used for all text in the app.
**Display (cover only):** Big Shoulders (700, 800), uppercase, for the cover headline, section headings, the ledger numbers and the abnormality tag. It never appears inside the app screens.
**IDs** (bodies, regions, cards, tickets, model versions): the same face at 600 with tabular figures. There is no monospace; dotted or slashed zeros are not used.

**Character:** A plain, classic, legible sans in the spirit of Toyota's humanist-technical lettering, which is proprietary and not used.

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

Depth comes from frosted glass. Panels float over the gradient with blur, a white edge, an inner highlight and a soft cool shadow (`inset 0 1px 0 rgba(255,255,255,.9), 0 12px 32px rgba(28,42,58,.10)`). Plate bands, badges and buttons use 135° gradients of their signal colour. Two further shadows exist:
- **Plate** (`0 1px 2px rgba(0,0,0,.06), 0 2px 6px rgba(0,0,0,.05)`): sign plates and the station image.
- **Overlay** (`0 8px 24px rgba(0,0,0,.14)`): sheets and toasts.

## Shapes

- Interactive elements (buttons, badges, chips, the role switcher) are full pills.
- Panels and plates use 8 px corners; icon tiles 6 px; inputs 4 px. Feature surfaces (sheets and dialogs, the landing hero demo card and the landing A3 sheet) use 16 px.
- Tables have no radius and use horizontal rules only: a 2 px ink header rule and 1 px row rules.

## Components

### Sign Plate (signature)
- A solid colour band holds a square pictogram tile and the state in plain words ("Caution: bead break", "Validated: safe to reuse"). The facts sit below on white.
- Caution and stop bands carry an 8 px hazard-stripe edge.
- Use a plate only where a decision is pending or a state is final. Never use one as a generic card.

### Buttons
- **Primary:** charcoal gradient pill (#3b3b3b to #1b1b1b) with an inner highlight and a soft shadow; white 16 px bold text, 48 px tall. On floor screens it is 72 px, 20 px text and full width.
- **Ghost:** half-white glass with a 2 px ink border. On hover it fills with the charcoal gradient.
- **Stop:** red gradient pill (#ee1f33 to #c50818), used only for "Stop and fix".
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

### Camera Feed
- One station camera tile, dark in both themes because it is a screen. Chrome: station chip with a state pip, LIVE or the frame time, the source label and REC. A vignette and faint interlace sit over the picture.
- Three sources, honest about what they are: a public test clip (black and white, labelled "Test clip · no annotation", **never** carries a box), a drawn sealer scene ("Simulated scene", animated only when focused), and the alert frame (our bead illustration with the heatmap, "Alert frame hh:mm:ss · simulated").
- Tone outlines: yellow for an alert waiting, blue for model review or attention, red with "Signal lost" for offline.
- Used on `/cameras` (wall 2×2/3×3/4×4, focus panel, shift timeline, camera health) and on Station (Alert frame / Live switch).

### The Line (shift board and cover)
- K2-Body as an engineer's scale model in three.js, loaded only on the client. Grey floor and lane, steel gantries, one four-lamp andon tower per station (red, yellow, green, blue from top).
- Car bodies are body-in-white shells (fictional, unbranded CC BY models) recoloured from the palette: steel grey with thin edge lines; only the body waiting on a decision turns caution yellow. If the models fail to load, a drawn body stays.
- Lamps carry state: yellow andon breathes, red when the team leader has stopped the line, blue for model review, dim green when running. Labels show the station and, when abnormal, a state chip.
- A station strip under the model is the keyboard path and the fallback when WebGL is missing. A pause button stops all motion; reduced motion starts paused. Wheel never zooms the page.

### Provenance Chip
- A small outlined chip on every figure that could be mistaken for a measurement: **Case data** (book icon), **Target** (flag, dashed border), **Simulated** (chip icon, panel fill), **Illustration**, **Benchmark**. Text says the source ("Casebook survey", "ES Gate 1").

### Ask the Line (assistant dock)
- A charcoal pill "Ask the line" fixed bottom right on every screen except Knowledge and the cover; on phone it sits above the tab bar as a round button. It opens the same grounded assistant panel: suggestions, cited answers (green citation chip with card ID and revision), and "Route to owner engineer" when no card covers the question.

### Bead Illustration
- A close-up of a door hem seam: outer panel with a press line and pilot hole, flange with spot welds and a contact shadow, and the PVC bead drawn as a matte, rounded stroke through an SVG lighting filter. Same framing for every defect type so images compare directly. Always labelled as an illustration.

### Sheets
- Native `<dialog>`. On phone it is a bottom sheet (drawer curve `cubic-bezier(.32,.72,0,1)`); on desktop it is a centred card. Entry uses `@starting-style`.

## Dark theme

Every page has a light and a dark theme. The default follows the device; the sun/moon toggle in the top bar overrides it, the choice is remembered, and it is passed to embedded frames. Dark is a **dark grey gradient, never pure black**:
- **Ground:** radial washes of #3c3f43, #2c2e31 and #303235 over a linear gradient from #2a2c2f to #1f2123. Page base #232527.
- **Glass:** white at 6.5% with a 12% white edge; strong glass (sheets) rgba(46, 48, 52, .95).
- **Ink:** #ececec, ink-2 #d2d2d2, muted #a3a3a3.
- **Primary buttons invert:** a light gradient (#f4f4f4 to #d9d9d9) with #1b1b1b text.
- **Signal colours stay the same.** Ink on yellow signs and hazard stripes stays #1f1f1f in both themes. Green and blue text on tints lighten to #74d39d and #84bdf0.
- **Fixed elements:** camera feeds, the cover camera band and the device bezels look the same in both themes. The 3D line switches to a darker steel palette with higher exposure.

## Landing (cover)

`app/page.tsx` (study: `design/mockup/landing3.html`). Few words, and no two sections in a row share a composition:
1. **Hero, centred:** "AI DETECTS. PEOPLE DECIDE." over the full-width 3D line; one sentence; two pills; a live strip with takt, bodies this shift and the current andon.
2. **The trail on a centre spine:** a sticky abnormality tag (punched card, hazard stripe) in the middle; five steps alternate left and right, each with who decides. Stamps appear only for steps that really happened; the rest say "Waiting".
3. **Three signs:** stop, caution and safe plates for the three things the system never does.
4. **Cameras, full bleed:** a dark band with a camera mosaic, the alert frame large in the centre, and a legend of what each frame is.
5. **Ledger, centred:** large baseline → target figures with provenance chips; the whole case on one A3 sits behind "Read the whole case on one A3".
6. **Closing, centred:** one heading, one button, a laptop and phone with real app captures.

Footer: the TMMIN case text, "not affiliated with or endorsed by Toyota", footage and model credits. No logos at all.

## Do's and Don'ts

### Do:
- **Do** keep every screen grey and ink until something is abnormal, pending or final.
- **Do** label every simulated image and number as simulated.
- **Do** show who decided ("Decided by team leader · role:team-leader@body") after every human action.
- **Do** keep operator and team-leader targets at 48 px or more, and primary actions at 72 px.
- **Do** respect `prefers-reduced-motion`; motion is limited to state changes of 150–250 ms, and the 3D line starts paused.
- **Do** put a provenance chip on any figure a reader could take for a measured result.

### Don't:
- **Don't** use Toyota Red for anything except the brand strip, stop and leak-critical.
- **Don't** colour loops, categories, selections or progress with signal colours.
- **Don't** fade content with opacity to de-emphasise it.
- **Don't** use KPI-card rows (a big number over a small label). Put metrics in ruled tables.
- **Don't** put colour (red, purple, blue, green or any hue) in the background gradient.
- **Don't** add eyebrows or kickers above headings, saturated or purple-neon gradients, glow halos, or em-dashes. Gradients stay soft on the ground and signal-coloured on state elements.
- **Don't** use monospace fonts.
- **Don't** use the Toyota emblem, Toyota Type, faces or personal names, and don't add competition or partner logos.
- **Don't** use 3D models or images of real branded vehicles, or keep their paint colours; car bodies are unbranded and recoloured from the palette.
- **Don't** draw a detection box over a real video clip.
- **Don't** use pure black (#000) for dark-mode backgrounds.
