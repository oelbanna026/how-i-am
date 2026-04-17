# Design System Specification

## 1. Overview & Creative North Star
The creative North Star for this design system is **"The Neon Dynasty."** 

We are moving away from the safe, sterile layouts of traditional mobile apps. This system is a collision of ancient prestige and modern Cairo street culture—think high-end streetwear aesthetics meets a midnight rave on the Nile. To achieve this, we avoid "template" looks by utilizing **intentional asymmetry**, overlapping glass layers, and a typography scale that feels more like a fashion magazine than a utility app. The goal is "Viral Social Energy": every screen should feel like a captured moment worth sharing.

## 2. Colors & Surface Logic
The palette is built on a foundation of deep, ink-like shadows punctuated by high-frequency neons.

### The Surface Hierarchy (Nesting)
Instead of using lines to separate content, we use **Tonal Layering**. 
- **Base Layer:** `surface` (#0a0e16) acts as the canvas.
- **Sectioning:** Use `surface_container_low` for large background areas and `surface_container_high` for interactive elements.
- **Nesting:** Place a `surface_container_highest` (#202632) card inside a `surface_container` area to create natural, soft depth.

### The "No-Line" Rule
**Explicit Instruction:** You are prohibited from using 1px solid borders to section off parts of the UI. Separation must be achieved through:
1.  **Background Shifts:** Moving from `surface` to `surface_container_low`.
2.  **Negative Space:** Using the 8pt grid to create clear rhythmic gaps.
3.  **Glass Volumes:** Using the glassmorphism formula below to define boundaries.

### The Glass & Gradient Rule
To move beyond a flat, "out-of-the-box" UI, apply these signature treatments:
- **Glassmorphism:** Use `rgba(255, 255, 255, 0.08)` fill with a heavy `backdrop-filter: blur(20px)`. This is the primary treatment for floating cards and bottom sheets.
- **Signature Gradients:** For main CTAs and hero states, transition from `primary` (#ffb22b) to `primary_container` (#f1a40c). This adds "visual soul" and prevents the neon colors from looking like flat vector shapes.

## 3. Typography: Editorial Hierarchy
We use **Plus Jakarta Sans** (which pairs perfectly with Cairo for Arabic localization). Our typography is not just for reading; it is a design element in itself.

- **Display Scales:** Use `display-lg` (3.5rem) for "Viral Moments"—round wins, big scores, or game invites. These should often be slightly offset or overlapping other elements to break the grid.
- **Contrast:** Pair a massive `display-md` header with a tiny, all-caps `label-md` for a high-end editorial feel.
- **Tonal Hierarchy:** Headers use `on_surface` (High Contrast), while secondary metadata uses `on_surface_variant` (Mid Contrast) to ensure the eye hits the most important "hook" first.

## 4. Elevation & Depth
In this design system, depth is "felt" through light, not "seen" through lines.

- **Ambient Shadows:** Standard drop shadows are forbidden. Use extra-diffused ambient glows. If an element is floating, use a shadow with a blur of 30px-40px at 8% opacity, tinted with the `primary` or `tertiary` color to mimic neon light bleed.
- **The "Ghost Border" Fallback:** If a boundary is strictly required for accessibility, use a **Ghost Border**: the `outline_variant` token at 15% opacity. It should feel like a suggestion of an edge, not a hard stop.
- **Stacking:** Treat the UI as physical layers of frosted glass. A `surface_bright` element should always feel physically higher than a `surface_dim` element.

## 5. Components

### Buttons (The Interaction Core)
- **Primary:** Gradient-filled (`primary` to `primary_container`), `lg` (2rem) rounded corners. Use a subtle inner glow on the top edge to simulate a "lit" neon tube.
- **Secondary (Glass):** `rgba(255, 255, 255, 0.08)` fill with a 1px Ghost Border. High blur.
- **Tertiary:** No background. Bold `tertiary` (#ff70da) text with a `label-md` uppercase style.

### Game Cards
Cards must never use dividers. Content within a card is separated by `surface_container_highest` blocks or vertical whitespace. 
- **Rounding:** Use `lg` (2rem) or `xl` (3rem) for the outer container and `md` (1.5rem) for nested inner elements to create a harmonious "squircle" nesting effect.

### Viral Chips
Used for social tags, player statuses, or "Egypt Street Humor" quips.
- **Style:** Use `secondary_container` with `on_secondary_container` text. These should be small, high-contrast, and placed in unexpected positions (e.g., overlapping the corner of a profile image) to maintain that "Street Style" energy.

### Input Fields
- **Background:** `surface_container_lowest` (Pure Black #000000).
- **Active State:** The border glows with a `primary` (#ffb22b) Ghost Border and a soft 4px outer glow.

## 6. Do's and Don'ts

### Do:
- **Overlap Elements:** Let a player's avatar overlap a card's edge. It creates energy.
- **Use High-Contrast Scales:** Make your big text bigger and your small text smaller.
- **Embrace the Dark:** Let the `background` breathe. Not every pixel needs a container.
- **Bottom-Heavy Layouts:** Keep all primary interactive components (Buttons, Inputs) within the thumb-zone (bottom 30% of the screen).

### Don't:
- **Don't use Divider Lines:** Use background tonal shifts instead.
- **Don't use Pure Grey Shadows:** Shadows should always be a low-opacity tint of the background or the accent color.
- **Don't use Standard Corners:** Avoid the 4px or 8px default. Stay within the `md` to `xl` range (24px+) to keep the "friendly but premium" vibe.
- **Don't Center Everything:** Use left-aligned editorial layouts with asymmetrical accents to keep the "Street-Style" energy alive.