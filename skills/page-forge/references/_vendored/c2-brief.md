## Adobe.com brand language (Consonant 2 / C2)

You are redesigning a page for adobe.com. Adobe.com uses the **Consonant 2**
design system. Source: live Milo C2 checkout (libs/c2). **This is the most important section
of your brief — read it carefully.** Output that ignores these patterns
won't look like Adobe.com, full stop.

### What "looks like Adobe.com" means

1. **Typography is Adobe Clean / Adobe Clean Display.** Display headlines
   are HUGE (`--s2a-font-size-80` = 80px on desktop hero, dropping to
   ~48px on smaller heroes; section headings 32-48px). Tight tracking on
   display sizes (`--s2a-font-letter-spacing-neg-3_2`). Body copy is
   16-20px with a comfortable line-height of 24-32px.
2. **Default surface is dark or near-dark for brand moments**
   (`--s2a-color-gray-1000` / `--s2a-color-gray-900`) with white text
   (`--s2a-color-gray-25`). Light content surfaces use
   `--s2a-color-gray-25` or `--s2a-color-gray-50`. Accent is restrained
   — Adobe red (`--s2a-color-brand-adobe-red` = #eb1000, or
   `--s2a-color-red-700` for the C2 "alert" red) used SPARINGLY as a
   highlight, never as a section fill.
3. **Generous vertical rhythm.** Sections use `--s2a-layout-sm` (80px)
   to `--s2a-layout-lg` (124px) of vertical padding on desktop. Hero
   sections are typically 100vh or 640px tall.
4. **Horizontal gutters of ~8.333%** (router-marquee uses this exact value)
   on full-bleed sections; `max-width` containers around 1440px with
   centered alignment.
5. **Pill buttons with 2px border, transparent fill** (the .con-button
   pattern below). Hover inverts to solid black/white. NOT filled blue or
   green chips — that's a different design language.
6. **Cards use 4:3 aspect-ratio media with 16px clip-path radius**
   (`--s2a-border-radius-md`) and a subtle 1.05× scale on hover.
7. **No drop shadows on hero / brand surfaces.** Cards use minimal
   shadowing — most of the depth comes from the dark vs light surface
   alternation, not layering tricks.
8. **One `<h1>` per page (in the hero/marquee).** Subsequent sections
   use `<h2>` / `<h3>`. Eyebrow labels are short, uppercase, 12-14px,
   with bold weight.

### C2 tokens to use in your prototype's `:root`

Prefer these over invented hex values. If you need a color/spacing that
isn't here, pick the closest `--s2a-*` token rather than introducing a
new variable. You may alias into page-local tokens
(`--page-bg: var(--s2a-color-gray-1000);`) for readability.

```css
:root {
  --s2a-color-gray-25: #fff;
  --s2a-color-gray-50: #f8f8f8;
  --s2a-color-gray-75: #f3f3f3;
  --s2a-color-gray-100: #e9e9e9;
  --s2a-color-gray-200: #e1e1e1;
  --s2a-color-gray-300: #dadada;
  --s2a-color-gray-400: #c6c6c6;
  --s2a-color-gray-500: #8f8f8f;
  --s2a-color-gray-600: #717171;
  --s2a-color-gray-700: #505050;
  --s2a-color-gray-800: #292929;
  --s2a-color-gray-900: #131313;
  --s2a-color-gray-1000: #000;
  --s2a-color-green-100: #edfcf1;
  --s2a-color-green-200: #d7f7e1;
  --s2a-color-green-300: #adeec5;
  --s2a-color-green-400: #6be3a2;
  --s2a-color-green-500: #2bd17d;
  --s2a-color-green-600: #12b867;
  --s2a-color-green-700: #0ba45d;
  --s2a-color-green-800: #079355;
  --s2a-color-green-900: #05834e;
  --s2a-color-green-1000: #036e45;
  --s2a-color-green-1100: #025d3c;
  --s2a-color-green-1200: #014c34;
  --s2a-color-green-1300: #003d2c;
  --s2a-color-green-1400: #002e22;
  --s2a-color-green-1500: #002119;
  --s2a-color-green-1600: #000f0c;
  --s2a-color-blue-100: #f5f9ff;
  --s2a-color-blue-200: #e5f0fe;
  --s2a-color-blue-300: #cbe2fe;
  --s2a-color-blue-400: #accffd;
  --s2a-color-blue-500: #8eb9fc;
  --s2a-color-blue-600: #729efd;
  --s2a-color-blue-700: #5d89ff;
  --s2a-color-blue-800: #4b75ff;
  --s2a-color-blue-900: #3b63fb;
  --s2a-color-blue-1000: #274dea;
  --s2a-color-blue-1100: #1d3ecf;
  --s2a-color-blue-1200: #1532ad;
  --s2a-color-blue-1300: #10288c;
  --s2a-color-blue-1400: #0c1f69;
  --s2a-color-blue-1500: #0e1843;
  --s2a-color-blue-1600: #070b1e;
  --s2a-color-red-100: #fff6f5;
  --s2a-color-red-200: #ffebe8;
  --s2a-color-red-300: #ffd6d1;
  --s2a-color-red-400: #ffbcb4;
  --s2a-color-red-500: #ff9d91;
  --s2a-color-red-600: #ff7665;
  --s2a-color-red-700: #ff513d;
  --s2a-color-red-800: #f03823;
  --s2a-color-red-900: #d73220;
  --s2a-color-red-1000: #b72818;
  --s2a-color-red-1100: #9c2113;
  --s2a-color-red-1200: #811b0e;
  --s2a-color-red-1300: #68150a;
  --s2a-color-red-1400: #501006;
  --s2a-color-red-1500: #3b0b04;
  --s2a-color-red-1600: #1d0502;
  --s2a-color-orange-100: #fff6e7;
  --s2a-color-orange-200: #ffeccf;
  --s2a-color-orange-300: #ffda9e;
  --s2a-color-orange-400: #ffc15e;
  --s2a-color-orange-500: #ffa213;
  --s2a-color-orange-600: #fc7d00;
  --s2a-color-orange-700: #e86a00;
  --s2a-color-orange-800: #d45b00;
  --s2a-color-orange-900: #c24e00;
  --s2a-color-orange-1000: #a73e00;
  --s2a-color-orange-1100: #903300;
  --s2a-color-orange-1200: #762900;
  --s2a-color-orange-1300: #5f2000;
  --s2a-color-orange-1400: #491800;
  --s2a-color-orange-1500: #341200;
  --s2a-color-orange-1600: #190800;
  --s2a-color-yellow-100: #fff8cc;
  --s2a-color-yellow-200: #fff197;
  --s2a-color-yellow-300: #ffde2c;
  --s2a-color-yellow-400: #f5c700;
  --s2a-color-yellow-500: #e6af00;
  --s2a-color-yellow-600: #d29500;
  --s2a-color-yellow-700: #c18300;
  --s2a-color-yellow-800: #af7400;
  --s2a-color-yellow-900: #9e6600;
  --s2a-color-yellow-1000: #865500;
  --s2a-color-yellow-1100: #724800;
  --s2a-color-yellow-1200: #5d3b00;
  --s2a-color-yellow-1300: #4b2f00;
  --s2a-color-yellow-1400: #382300;
  --s2a-color-yellow-1500: #281900;
  --s2a-color-yellow-1600: #120b00;
  --s2a-color-transparent-black-12: rgb(0 0 0 / 12%);
  --s2a-color-transparent-black-16: rgb(0 0 0 / 16%);
  --s2a-color-transparent-black-24: rgb(0 0 0 / 24%);
  --s2a-color-transparent-black-32: rgb(0 0 0 / 32%);
  --s2a-color-transparent-black-48: rgb(0 0 0 / 48%);
  --s2a-color-transparent-black-64: rgb(0 0 0 / 64%);
  --s2a-color-transparent-black-00: rgb(0 0 0 / 0);
  --s2a-color-transparent-black-04: rgb(0 0 0 / 4%);
  --s2a-color-transparent-black-08: rgb(0 0 0 / 8%);
  --s2a-color-transparent-white-12: rgb(255 255 255 / 12%);
  --s2a-color-transparent-white-16: rgb(255 255 255 / 16%);
  --s2a-color-transparent-white-24: rgb(255 255 255 / 24%);
  --s2a-color-transparent-white-32: rgb(255 255 255 / 32%);
  --s2a-color-transparent-white-48: rgb(255 255 255 / 48%);
  --s2a-color-transparent-white-64: rgb(255 255 255 / 64%);
  --s2a-color-transparent-white-00: rgb(255 255 255 / 0);
  --s2a-color-transparent-white-04: rgb(255 255 255 / 4%);
  --s2a-color-transparent-white-08: rgb(255 255 255 / 8%);
  --s2a-color-brand-adobe-red: #eb1000;
  --s2a-color-brand-cc-3dar: #99e83f;
  --s2a-color-brand-cc-il: #ff9a00;
  --s2a-color-brand-cc-ppafx: #99f;
  --s2a-color-brand-cc-ps: #3a18ff;
  --s2a-border-radius-0: 0;
  --s2a-border-radius-2: 2px;
  --s2a-border-radius-4: 4px;
  --s2a-border-radius-8: 8px;
  --s2a-border-radius-12: 12px;
  --s2a-border-radius-16: 16px;
  --s2a-border-radius-24: 24px;
  --s2a-border-radius-32: 32px;
  --s2a-border-radius-999: 999px;
  --s2a-border-width-0: 0;
  --s2a-border-width-1: 1px;
  --s2a-border-width-2: 2px;
  --s2a-border-width-4: 4px;
  --s2a-opacity-16: 16px;
  --s2a-opacity-24: 24px;
  --s2a-opacity-32: 32px;
  --s2a-opacity-48: 48px;
  --s2a-opacity-64: 64px;
  --s2a-opacity-100: 100px;
  --s2a-opacity-00: 0;
  --s2a-opacity-08: 8px;
  --s2a-shadow-level-1-x: 0;
  --s2a-shadow-level-1-y: 1px;
  --s2a-shadow-level-1-blur: 6px;
  --s2a-shadow-level-1-spread: 0;
  --s2a-shadow-level-2-x: 0;
  --s2a-shadow-level-2-y: 2px;
  --s2a-shadow-level-2-blur: 8px;
  --s2a-shadow-level-2-spread: 0;
  --s2a-shadow-level-3-x: 0;
  --s2a-shadow-level-3-y: 4px;
  --s2a-shadow-level-3-blur: 12px;
  --s2a-shadow-level-3-spread: 0;
  --s2a-shadow-level-4-x: 0;
  --s2a-shadow-level-4-y: 6px;
  --s2a-shadow-level-4-blur: 16px;
  --s2a-shadow-level-4-spread: 0;
  --s2a-spacing-0: 0;
  --s2a-spacing-2: 2px;
  --s2a-spacing-4: 4px;
  --s2a-spacing-8: 8px;
  --s2a-spacing-12: 12px;
  --s2a-spacing-16: 16px;
  --s2a-spacing-20: 20px;
  --s2a-spacing-24: 24px;
  --s2a-spacing-32: 32px;
  --s2a-spacing-40: 40px;
  --s2a-spacing-48: 48px;
  --s2a-spacing-64: 64px;
  --s2a-spacing-80: 80px;
  --s2a-spacing-96: 96px;
  --s2a-spacing-124: 124px;
  --s2a-spacing-160: 160px;
  --s2a-spacing-240: 240px;
  --s2a-font-family-adobe-clean: "Adobe Clean";
  --s2a-font-family-adobe-clean-display: "Adobe Clean Display";
  --s2a-font-letter-spacing-0: 0;
  --s2a-font-letter-spacing-neg-3_84: -3.84px;
  --s2a-font-letter-spacing-neg-3_2: -3.2px;
  --s2a-font-letter-spacing-neg-2_88: -2.88px;
  --s2a-font-letter-spacing-neg-1_68: -1.68px;
  --s2a-font-letter-spacing-neg-1_44: -1.44px;
  --s2a-font-letter-spacing-neg-1_2: -1.2px;
}

:root {
  --s2a-border-radius-none: var(--s2a-border-radius-0);
  --s2a-border-radius-2xs: var(--s2a-border-radius-2);
  --s2a-border-radius-xs: var(--s2a-border-radius-4);
  --s2a-border-radius-sm: var(--s2a-border-radius-8);
  --s2a-border-radius-md: var(--s2a-border-radius-16);
  --s2a-border-radius-lg: var(--s2a-border-radius-32);
  --s2a-border-radius-round: var(--s2a-border-radius-999);
  --s2a-border-width-sm: var(--s2a-border-width-1);
  --s2a-border-width-md: var(--s2a-border-width-2);
  --s2a-border-width-lg: var(--s2a-border-width-4);
  --s2a-opacity-scrim-subtle: var(--s2a-opacity-32);
  --s2a-opacity-disabled: var(--s2a-opacity-48);
  --s2a-opacity-scrim-strong: var(--s2a-opacity-64);
  --s2a-spacing-none: var(--s2a-spacing-0);
  --s2a-spacing-3xs: var(--s2a-spacing-2);
  --s2a-spacing-2xs: var(--s2a-spacing-4);
  --s2a-spacing-xs: var(--s2a-spacing-8);
  --s2a-spacing-sm: var(--s2a-spacing-12);
  --s2a-spacing-md: var(--s2a-spacing-16);
  --s2a-spacing-lg: var(--s2a-spacing-24);
  --s2a-spacing-xl: var(--s2a-spacing-32);
  --s2a-spacing-2xl: var(--s2a-spacing-40);
  --s2a-spacing-3xl: var(--s2a-spacing-48);
  --s2a-spacing-4xl: var(--s2a-spacing-64);
  --s2a-font-family-heading: var(--s2a-font-family-adobe-clean-display);
  --s2a-font-family-default: var(--s2a-font-family-adobe-clean);
  --s2a-font-family-title: var(--s2a-font-family-adobe-clean-display);
  --s2a-font-family-subheading: var(--s2a-font-family-adobe-clean-display);
  --s2a-font-family-body: var(--s2a-font-family-adobe-clean);
  --s2a-font-family-label: var(--s2a-font-family-adobe-clean);
  --s2a-font-family-eyebrow: var(--s2a-font-family-adobe-clean);
  --s2a-font-family-caption: var(--s2a-font-family-adobe-clean);
  --s2a-font-letter-spacing-xs: var(--s2a-font-letter-spacing-neg-3_84);
  --s2a-font-letter-spacing-sm: var(--s2a-font-letter-spacing-neg-3_2);
  --s2a-font-letter-spacing-md: var(--s2a-font-letter-spacing-neg-2_88);
  --s2a-font-letter-spacing-lg: var(--s2a-font-letter-spacing-neg-1_68);
  --s2a-font-letter-spacing-xl: var(--s2a-font-letter-spacing-neg-1_44);
  --s2a-font-letter-spacing-2xl: var(--s2a-font-letter-spacing-neg-1_2);
  --s2a-font-letter-spacing-3xl: var(--s2a-font-letter-spacing-neg-0_96);
  --s2a-font-letter-spacing-4xl: var(--s2a-font-letter-spacing-neg-0_48);
  --s2a-font-letter-spacing-5xl: var(--s2a-font-letter-spacing-neg-0_2);
  --s2a-font-letter-spacing-6xl: var(--s2a-font-letter-spacing-0);
  --s2a-font-letter-spacing-7xl: var(--s2a-font-letter-spacing-0_16);
  --s2a-font-letter-spacing-8xl: var(--s2a-font-letter-spacing-0_24);
  --s2a-font-line-height-2xs: var(--s2a-font-line-height-16);
  --s2a-font-line-height-xs: var(--s2a-font-line-height-18);
  --s2a-font-line-height-sm: var(--s2a-font-line-height-20);
  --s2a-font-line-height-md: var(--s2a-font-line-height-24);
  --s2a-font-line-height-lg: var(--s2a-font-line-height-32);
  --s2a-font-line-height-xl: var(--s2a-font-line-height-40);
  --s2a-font-line-height-2xl: var(--s2a-font-line-height-48);
  --s2a-font-line-height-3xl: var(--s2a-font-line-height-56);
  --s2a-font-line-height-4xl: var(--s2a-font-line-height-69);
  --s2a-font-line-height-5xl: var(--s2a-font-line-height-76);
  --s2a-font-line-height-6xl: var(--s2a-font-line-height-92);
  --s2a-font-size-xs: var(--s2a-font-size-12);
  --s2a-font-size-sm: var(--s2a-font-size-14);
  --s2a-font-size-md: var(--s2a-font-size-16);
  --s2a-font-size-lg: var(--s2a-font-size-18);
  --s2a-font-size-xl: var(--s2a-font-size-20);
  --s2a-font-size-2xl: var(--s2a-font-size-24);
  --s2a-font-size-3xl: var(--s2a-font-size-32);
  --s2a-font-size-4xl: var(--s2a-font-size-40);
  --s2a-font-size-5xl: var(--s2a-font-size-48);
  --s2a-font-size-6xl: var(--s2a-font-size-56);
  --s2a-font-size-7xl: var(--s2a-font-size-64);
  --s2a-font-size-8xl: var(--s2a-font-size-72);
  --s2a-font-size-9xl: var(--s2a-font-size-80);
  --s2a-font-size-10xl: var(--s2a-font-size-96);
  --s2a-blur-xs: var(--s2a-blur-8);
  --s2a-blur-sm: var(--s2a-blur-16);
  --s2a-blur-md: var(--s2a-blur-32);
  --s2a-blur-lg: var(--s2a-blur-64);
  --s2a-layout-sm: var(--s2a-spacing-80);
  --s2a-layout-md: var(--s2a-spacing-96);
  --s2a-layout-lg: var(--s2a-spacing-124);
  --s2a-layout-xl: var(--s2a-spacing-160);
  --s2a-layout-2xl: var(--s2a-spacing-240);
}
```

### Section padding recipe

Adobe.com sections use one of these vertical-rhythm patterns. Pick by
surface intensity:

```css
/* Hero / marquee surfaces — biggest breathing room */
main > section.hero { padding: var(--s2a-layout-lg) 8.333%; }
/* Standard content sections */
main > section { padding: var(--s2a-layout-md) 8.333%; }
/* Tighter utility sections */
main > section.compact { padding: var(--s2a-layout-sm) 8.333%; }
```

### Hero / marquee — type sizes and content stack — lifted from milo

```css
.router-marquee {
  position: relative;
  overflow: hidden;
}

.rm-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  color: var(--s2a-color-gray-25);
  width: 100%;

  /* Temp fix for plain links in rm-content */
  a:not(.con-button) {
    color: inherit;
    text-decoration: underline;

    &:hover {
      text-decoration: none;
    }
  }
}

.rm-title {
  font-weight: var(--s2a-font-weight-adobe-clean-black);
  margin: 0;
  color: inherit;
}

.rm-eyebrow {
  font-weight: var(--s2a-font-weight-adobe-clean-bold);
  font-size: var(--s2a-font-size-16);
  line-height: 20px;
  letter-spacing: var(--s2a-font-letter-spacing-neg-0_2);
  margin: 0;
}

.rm-body {
  display: flex;
  flex-direction: column;
  gap: var(--s2a-spacing-32);
}
```

### Card grid — image + foreground + hover lift — lifted from milo

```css
.base-card {
  position: relative;
  height: 100%;
  contain: layout;

  > div {
    display: flex;
    flex-direction: column-reverse;
  }

  .media {
    position: relative;
    clip-path: inset(0 round var(--s2a-border-radius-md));
    overflow: clip;

    > picture {
      height: 100%;
      display: flex;
    }

    .icon {
      height: 24px;
      width: 24px;
      position: absolute;
      top: var(--s2a-spacing-md);
      inset-inline-start: var(--s2a-spacing-md);

      img {
        width: 24px;
      }
    }

    > div,
    > picture {
      height: 100%;
    }

    picture:not(.icon) img {
      width: 100%;
      object-fit: cover;
      aspect-ratio: 4/3;
      transition: transform 0.3s ease;
    }
  }

  &:hover .media picture:not(.icon) img {
    transform: scale(1.05);
  }

  .foreground {
    padding: var(--s2a-spacing-24) var(--s2a-spacing-16) 0 var(--s2a-spacing-16);

    :is(h1, h2, h3, h4, h5, h6) {
      margin-bottom: var(--s2a-spacing-8);
      color: var(--s2a-color-gray-1000);
    }

    .standalone-link {
      color: var(--s2a-color-gray-1000);
      text-decoration: none;
      display: inline-block;
      margin-top: var(--s2a-spacing-24);
      margin-inline-end: var(--s2a-spacing-12);
      margin-bottom: var(--s2a-spacing-4);

      &::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: 1;
      }
    }
  }

  p {
    color: var(--s2a-color-transparent-black-64);
  }

  &.featured {
    .foreground {
      padding: var(--s2a-spacing-24) var(--s2a-spacing-16) var(--s2a-spacing-40) var(--s2a-spacing-16);
    }

    .parallax-featured-card-media {
      animation-name: grow-featured-card-radius;
      will-change: clip-path;
    }
  }
}
```

### Rich content / centered narrative section — lifted from milo

```css
.rich-content {
  --content-gap: var(--s2a-spacing-8);

  position: relative;
  box-sizing: border-box;

  &.center {
    text-align: center;
  }

  &.hero {
    height: 640px;
  }

  &.dark {
    background-color: unset;
  }

  .foreground .content {
    display: flex;
    align-items: flex-start;
    flex-direction: column;
    gap: var(--content-gap);
    position: relative;
    z-index: 2;

    [class*="body-"]:not(.action-area) {
      max-width: 680px;
    }
  }

  &.center .foreground .content {
    align-items: center;
  }

  .action-area {
    margin-top: calc(var(--s2a-spacing-24) - var(--content-gap));
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: var(--content-gap);
  }
}
```

### Adobe.com buttons (.con-button — the canonical pattern)

Use this verbatim in your prototype's `<style>`. CTAs in content should
be `<strong><a class="con-button button-xl">…</a></strong>` for primary
and `<em><a class="con-button button-xl">…</a></em>` for secondary. The
downstream Milo decorator picks up the `<strong>` / `<em>` wrapping
and re-applies the same classes.

```css
.con-button {
  background-color: transparent;
  border-radius: 16px;
  border: 2px solid var(--text-color);
  color: var(--text-color);
  display: inline-block;
  font-size: 15px;
  font-weight: 700;
  line-height: 16px;
  padding: 5px 14px;
  text-decoration: none;
}

.con-button:hover {
  background-color: var(--s2a-color-gray-1000);
  border-color: var(--s2a-color-gray-1000);
  color: var(--s2a-color-gray-25);
  text-decoration: none;
}

.con-button.button-l  { border-radius: 20px; font-size: 17px; line-height: 20px; padding: 7px 18px 8px; }
.con-button.button-xl { border-radius: 25px; font-size: 19px; line-height: 24px; padding: 10px 24px 8px; }
.con-button.button-xxl{ border-radius: 30px; font-size: 22px; line-height: 27px; padding: 14px 30px 15px; }

.dark .con-button  { border-color: var(--s2a-color-gray-25); color: var(--s2a-color-gray-25); }
.light .con-button { border-color: var(--text-color);        color: var(--text-color); }

.dark .con-button:hover {
  background-color: var(--s2a-color-gray-25);
  color: var(--s2a-color-gray-1000);
  text-decoration: none;
}

.light .con-button:hover {
  background-color: var(--s2a-color-gray-1000);
  border-color: var(--s2a-color-gray-1000);
  color: var(--s2a-color-gray-25);
}
```

### Milo blocks the downstream pipeline can author

The block-matcher knows these blocks (and ~25 more C1 blocks). For each
top-level `<section>` in your output, target one of them by adding a
candidate-block hint comment:

```html
<!-- candidate-block: marquee, variants: large, dark -->
<section class="hero">…</section>

<!-- candidate-block: columns, variants: 3 -->
<section class="features">…</section>

<!-- candidate-block: accordion -->
<section class="faq">…</section>
```

C2 block folder list (for reference): base-card, brand-concierge, carousel-c2, elastic-carousel, explore-card, global-footer, global-navigation, martech-metadata, modal, news, region-nav, rich-content, router-marquee, section-metadata, visually-hidden.

The matcher treats these comments as hints, not commitments — if the name
isn't an exact match in the catalog, it ignores the hint and scores fresh.
So write them best-effort; mislabeling is a soft signal, not a hard fail.

### Composition rules

- Hero (marquee): dark surface, full-bleed image background, white
  display heading, white body, primary + secondary CTA pair.
- 2nd section: light surface, eyebrow + headline + body, optionally a
  centered single CTA. Use `text` or `rich-content` block shape.
- Card grid: 3 columns of `base-card` shape (image + heading + body
  + arrow link). Use `columns` or a card-collection equivalent.
- Closing CTA: dark surface again, big headline, single primary CTA.
  Symmetric with the hero at the bottom of the page.
- Avoid: zebra-striping every section, neon accents, unmotivated gradients,
  drop shadows everywhere, multiple display fonts.

### Authoring rules that downstream pipelines depend on

- Primary CTA: `<strong><a>...</a></strong>` inside a `<p>`.
- Secondary CTA: `<em><a>...</a></em>` inside a `<p>`.
- Headings: `<h1>` once per page (hero), then `<h2>`/`<h3>` per section.
- Use `<picture><img></picture>` for images, never CSS background-images
  for primary content media (the block-matcher reads `<img>` to detect
  a media slot).
- One logical content area per top-level `<section>`. Don't nest sections.
