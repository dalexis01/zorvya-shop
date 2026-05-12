import type { HomepageVisualStyles } from "@/lib/shop/admin-types";

export const HOMEPAGE_FONT_OPTIONS = [
  {
    label: "Manrope",
    value:
      'var(--font-manrope), "Segoe UI", "Aptos", "Trebuchet MS", "Helvetica Neue", Arial, sans-serif',
  },
  {
    label: "Inter",
    value:
      'var(--font-inter), "Segoe UI", "Aptos", "Helvetica Neue", Arial, sans-serif',
  },
  {
    label: "Sora",
    value:
      'var(--font-sora), "Segoe UI", "Aptos", "Helvetica Neue", Arial, sans-serif',
  },
  {
    label: "System UI",
    value: '"Segoe UI", "Aptos", "Helvetica Neue", Arial, sans-serif',
  },
  { label: "Aptos", value: '"Aptos", "Segoe UI", Arial, sans-serif' },
  { label: "Segoe UI", value: '"Segoe UI", Arial, sans-serif' },
  { label: "Helvetica Neue", value: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { label: "Arial", value: 'Arial, "Helvetica Neue", sans-serif' },
  { label: "Verdana", value: 'Verdana, Geneva, sans-serif' },
  { label: "Tahoma", value: 'Tahoma, Verdana, sans-serif' },
  { label: "Trebuchet MS", value: '"Trebuchet MS", "Segoe UI", sans-serif' },
  { label: "Gill Sans", value: '"Gill Sans", "Trebuchet MS", sans-serif' },
  { label: "Gill Sans Nova", value: '"Gill Sans Nova", "Gill Sans", sans-serif' },
  { label: "Lucida Sans", value: '"Lucida Sans", "Lucida Grande", sans-serif' },
  { label: "Lucida Grande", value: '"Lucida Grande", "Lucida Sans", sans-serif' },
  { label: "Candara", value: 'Candara, "Segoe UI", sans-serif' },
  { label: "Corbel", value: 'Corbel, "Segoe UI", sans-serif' },
  { label: "Calibri", value: 'Calibri, "Segoe UI", sans-serif' },
  { label: "Geneva", value: 'Geneva, Verdana, sans-serif' },
  { label: "Optima", value: 'Optima, "Segoe UI", sans-serif' },
  { label: "Avenir", value: 'Avenir, "Helvetica Neue", Arial, sans-serif' },
  { label: "Avenir Next", value: '"Avenir Next", Avenir, "Helvetica Neue", sans-serif' },
  { label: "Futura", value: 'Futura, "Century Gothic", sans-serif' },
  { label: "Century Gothic", value: '"Century Gothic", Futura, sans-serif' },
  { label: "Franklin Gothic", value: '"Franklin Gothic Medium", "Arial Narrow", sans-serif' },
  { label: "Arial Narrow", value: '"Arial Narrow", Arial, sans-serif' },
  { label: "Avant Garde", value: '"Avant Garde", Avenir, sans-serif' },
  { label: "Montserrat Fallback", value: 'Montserrat, "Avenir Next", Arial, sans-serif' },
  { label: "Poppins Fallback", value: 'Poppins, "Avenir Next", Arial, sans-serif' },
  { label: "Nunito Fallback", value: 'Nunito, "Segoe UI", sans-serif' },
  { label: "DM Sans Fallback", value: '"DM Sans", "Segoe UI", sans-serif' },
  { label: "Rubik Fallback", value: 'Rubik, "Segoe UI", sans-serif' },
  { label: "Space Grotesk Fallback", value: '"Space Grotesk", "Segoe UI", sans-serif' },
  { label: "Plus Jakarta Sans Fallback", value: '"Plus Jakarta Sans", "Segoe UI", sans-serif' },
  { label: "Outfit Fallback", value: 'Outfit, "Segoe UI", sans-serif' },
  { label: "Urbanist Fallback", value: 'Urbanist, "Segoe UI", sans-serif' },
  { label: "Public Sans Fallback", value: '"Public Sans", "Segoe UI", sans-serif' },
  { label: "IBM Plex Sans Fallback", value: '"IBM Plex Sans", "Segoe UI", sans-serif' },
  { label: "Baskerville", value: 'Baskerville, Georgia, serif' },
  { label: "Georgia", value: 'Georgia, "Times New Roman", serif' },
  { label: "Palatino", value: '"Palatino Linotype", Palatino, serif' },
  { label: "Book Antiqua", value: '"Book Antiqua", Palatino, serif' },
  { label: "Cambria", value: 'Cambria, Georgia, serif' },
  { label: "Didot", value: 'Didot, "Times New Roman", serif' },
  { label: "Garamond", value: 'Garamond, Georgia, serif' },
  { label: "Bodoni", value: '"Bodoni MT", Didot, serif' },
  { label: "Big Caslon", value: '"Big Caslon", "Book Antiqua", serif' },
  { label: "Perpetua", value: 'Perpetua, Baskerville, serif' },
  { label: "Times New Roman", value: '"Times New Roman", Times, serif' },
  { label: "American Typewriter", value: '"American Typewriter", Georgia, serif' },
  { label: "Courier New", value: '"Courier New", Courier, monospace' },
  { label: "Consolas", value: 'Consolas, "Courier New", monospace' },
  { label: "Monaco", value: 'Monaco, Consolas, monospace' },
  { label: "Lucida Console", value: '"Lucida Console", Monaco, monospace' },
  { label: "Andale Mono", value: '"Andale Mono", Consolas, monospace' },
  { label: "Cascadia Code", value: '"Cascadia Code", Consolas, monospace' },
  { label: "Impact", value: 'Impact, Haettenschweiler, sans-serif' },
  { label: "Haettenschweiler", value: 'Haettenschweiler, Impact, sans-serif' },
  { label: "Copperplate", value: 'Copperplate, "Times New Roman", serif' },
  { label: "Rockwell", value: 'Rockwell, Georgia, serif' },
  { label: "Brush Script", value: '"Brush Script MT", cursive' },
  { label: "Snell Roundhand", value: '"Snell Roundhand", cursive' },
  { label: "Marker Felt", value: '"Marker Felt", "Trebuchet MS", sans-serif' },
  { label: "Papyrus", value: 'Papyrus, fantasy' },
  { label: "Bookman", value: 'Bookman, Georgia, serif' },
  { label: "Charter", value: 'Charter, Georgia, serif' },
  { label: "Hoefler Text", value: '"Hoefler Text", Georgia, serif' },
  { label: "Source Serif Fallback", value: '"Source Serif Pro", Georgia, serif' },
  { label: "Merriweather Fallback", value: 'Merriweather, Georgia, serif' },
  { label: "Playfair Fallback", value: '"Playfair Display", Georgia, serif' },
  { label: "Lora Fallback", value: 'Lora, Georgia, serif' },
  { label: "Cormorant Fallback", value: 'Cormorant, Georgia, serif' },
] as const;

function clampNumber(value: number | undefined, fallback: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Number(value)));
}

export function createDefaultHomepageVisualStyles(): HomepageVisualStyles {
  return {
    typography: {
      primaryFont: HOMEPAGE_FONT_OPTIONS[0].value,
      secondaryFont: HOMEPAGE_FONT_OPTIONS[2].value,
      baseFontSize: 15,
      baseFontWeight: 500,
    },
    headings: {
      h1Size: 46,
      h2Size: 30,
      h3Size: 20,
    },
    paragraphs: {
      size: 15,
      lineHeight: 1.7,
    },
    buttons: {
      radius: 999,
      textSize: 12,
      fontWeight: 700,
    },
    search: {
      radius: 999,
      textSize: 14,
      iconSize: 14,
      height: 38,
      maxWidth: 1248,
    },
    header: {
      paddingY: 16,
      titleSize: 19,
      taglineSize: 11,
      surfaceOpacity: 92,
    },
  };
}

export function normalizeHomepageVisualStyles(
  styles: Partial<HomepageVisualStyles> | HomepageVisualStyles | undefined
): HomepageVisualStyles {
  const fallback = createDefaultHomepageVisualStyles();

  return {
    typography: {
      primaryFont: styles?.typography?.primaryFont || fallback.typography.primaryFont,
      secondaryFont: styles?.typography?.secondaryFont || fallback.typography.secondaryFont,
      baseFontSize: clampNumber(styles?.typography?.baseFontSize, fallback.typography.baseFontSize, 13, 18),
      baseFontWeight: clampNumber(
        styles?.typography?.baseFontWeight,
        fallback.typography.baseFontWeight,
        400,
        800
      ),
    },
    headings: {
      h1Size: clampNumber(styles?.headings?.h1Size, fallback.headings.h1Size, 30, 56),
      h2Size: clampNumber(styles?.headings?.h2Size, fallback.headings.h2Size, 24, 40),
      h3Size: clampNumber(styles?.headings?.h3Size, fallback.headings.h3Size, 18, 30),
    },
    paragraphs: {
      size: clampNumber(styles?.paragraphs?.size, fallback.paragraphs.size, 13, 20),
      lineHeight: clampNumber(styles?.paragraphs?.lineHeight, fallback.paragraphs.lineHeight, 1.3, 2),
    },
    buttons: {
      radius: clampNumber(styles?.buttons?.radius, fallback.buttons.radius, 14, 999),
      textSize: clampNumber(styles?.buttons?.textSize, fallback.buttons.textSize, 11, 16),
      fontWeight: clampNumber(styles?.buttons?.fontWeight, fallback.buttons.fontWeight, 500, 800),
    },
    search: {
      radius: clampNumber(styles?.search?.radius, fallback.search.radius, 14, 999),
      textSize: clampNumber(styles?.search?.textSize, fallback.search.textSize, 12, 18),
      iconSize: clampNumber(styles?.search?.iconSize, fallback.search.iconSize, 12, 24),
      height: clampNumber(styles?.search?.height, fallback.search.height, 32, 64),
      maxWidth: clampNumber(styles?.search?.maxWidth, fallback.search.maxWidth, 360, 1800),
    },
    header: {
      paddingY: clampNumber(styles?.header?.paddingY, fallback.header.paddingY, 10, 28),
      titleSize: clampNumber(styles?.header?.titleSize, fallback.header.titleSize, 16, 28),
      taglineSize: clampNumber(styles?.header?.taglineSize, fallback.header.taglineSize, 10, 16),
      surfaceOpacity: clampNumber(styles?.header?.surfaceOpacity, fallback.header.surfaceOpacity, 70, 100),
    },
  };
}

export function getHomepageFontLabel(fontFamily: string) {
  return HOMEPAGE_FONT_OPTIONS.find((option) => option.value === fontFamily)?.label ?? "Personalizada";
}

export function hexToRgba(value: string, alpha: number) {
  const normalized = value.replace("#", "");
  const full = normalized.length === 3 ? normalized.split("").map((part) => `${part}${part}`).join("") : normalized;

  if (full.length !== 6) {
    return `rgba(3, 6, 17, ${alpha})`;
  }

  const red = Number.parseInt(full.slice(0, 2), 16);
  const green = Number.parseInt(full.slice(2, 4), 16);
  const blue = Number.parseInt(full.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
