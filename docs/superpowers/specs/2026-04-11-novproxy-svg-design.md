# Novproxy SVG Banner Design

## Goal

Create a reusable SVG marketing system for Novproxy that keeps the existing conversion-oriented copy structure while shifting the visual language from a purple promo banner to a more premium, infrastructure-driven technology aesthetic.

## Scope

Deliver:

- One master SVG template for reuse and future derivations
- One banner close to the current in-app aspect ratio
- One wide station/banner SVG
- One social-cover SVG

Do not:

- Replace existing app references automatically
- Fetch or embed the remote Novproxy logo unless a trusted local asset is provided later
- Generate PNG exports in this pass

## Copy

- Headline: `最具性价比的住宅 IP 提供商`
- Body: `Novproxy 的快速海外 IP，应用于社交媒体、账号管理等业务场景。`
- Primary CTA: `免费试用`
- Secondary CTA: `获得定价`
- Value pills:
  - `高质量`
  - `纯净度高`
  - `成功率99.9%`
  - `全天技术支持`
  - `流量永不过期`

## Visual Direction

### Recommended Direction

Tech-infrastructure hero:

- Deep navy background instead of the original purple
- Cyan, teal, and blue glow accents
- Abstract network map / routing / global connection motif on the right
- Soft glassmorphism cards and pills
- Large high-contrast Chinese headline on the left
- Strong primary CTA with luminous gradient treatment

### Brand Handling

Until the original logo asset is available locally, use a neutral constructed mark:

- Rounded square network icon
- `NOVPROXY` wordmark in uppercase Latin letters

This keeps the SVG self-contained and easily replaceable.

## Layout System

### Master Template

- Size: `1240x560`
- Left: wordmark, title, subtitle, CTA pair
- Right: globe / node / connection illustration
- Bottom: five value pills spanning the width

### Derived Assets

- `1220x552`: near-drop-in replacement for the current header banner ratio
- `1200x400`: compressed horizontal station banner
- `1200x630`: social cover with slightly taller visual emphasis

## Rendering Requirements

- Pure SVG, no external assets
- Scalable without bitmap dependencies
- Use gradients, masks, blur, and strokes conservatively so browser rendering stays reliable
- Keep text live instead of outlining it

## File Outputs

- `public/novproxy/novproxy-tech-template.svg`
- `public/novproxy/novproxy-banner-1220x552.svg`
- `public/novproxy/novproxy-banner-1200x400.svg`
- `public/novproxy/novproxy-social-1200x630.svg`

## Acceptance Criteria

- All four files open as valid SVGs
- Composition matches the approved "option B" direction: infrastructure, networked, premium
- The copy hierarchy is readable at a glance
- CTA buttons are visually distinct
- The set feels cohesive while each size is individually tuned
