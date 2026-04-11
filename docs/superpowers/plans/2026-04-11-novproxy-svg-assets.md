# Novproxy SVG Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable Novproxy SVG banner system with one master template and three production-ready size variants.

**Architecture:** Author standalone SVG files under `public/novproxy/` using a shared visual language rather than trying to parameterize a generator. Keep the current PNG untouched so integration stays low-risk, and validate the SVG syntax after creation.

**Tech Stack:** Vite static assets, raw SVG markup

---

### Task 1: Document the approved visual direction

**Files:**
- Create: `docs/superpowers/specs/2026-04-11-novproxy-svg-design.md`

- [ ] **Step 1: Write the design spec**

Add a concise spec covering copy, layout, output sizes, visual direction, and acceptance criteria so future edits stay aligned.

- [ ] **Step 2: Review the spec for ambiguity**

Check that the approved direction is explicitly "tech infrastructure" rather than a purple promo clone.

### Task 2: Create the SVG asset set

**Files:**
- Create: `public/novproxy/novproxy-tech-template.svg`
- Create: `public/novproxy/novproxy-banner-1220x552.svg`
- Create: `public/novproxy/novproxy-banner-1200x400.svg`
- Create: `public/novproxy/novproxy-social-1200x630.svg`

- [ ] **Step 1: Author the master template**

Create a balanced left-copy / right-illustration hero in `1240x560` using only inline SVG shapes, gradients, and live text.

- [ ] **Step 2: Derive the in-app banner ratio**

Create a `1220x552` version that preserves the template feel while matching the current PNG usage ratio.

- [ ] **Step 3: Derive the wide banner**

Create a `1200x400` compressed layout with tighter vertical spacing and retained CTA emphasis.

- [ ] **Step 4: Derive the social cover**

Create a `1200x630` version with a slightly more dramatic right-side illustration and more breathing room for the headline.

### Task 3: Validate deliverables

**Files:**
- Verify: `public/novproxy/novproxy-tech-template.svg`
- Verify: `public/novproxy/novproxy-banner-1220x552.svg`
- Verify: `public/novproxy/novproxy-banner-1200x400.svg`
- Verify: `public/novproxy/novproxy-social-1200x630.svg`

- [ ] **Step 1: Run XML validation**

Run: `for f in public/novproxy/*.svg; do xmllint --noout "$f"; done`
Expected: no output, exit code `0`

- [ ] **Step 2: Spot-check dimensions and file inventory**

Run: `ls public/novproxy && rg '<svg' public/novproxy/*.svg`
Expected: four SVG files listed and each contains a root `<svg>` element

- [ ] **Step 3: Leave integration untouched**

Do not update `src/App.tsx` in this pass so the new assets can be reviewed before adoption.
