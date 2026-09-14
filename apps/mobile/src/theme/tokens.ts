/**
 * Design tokens, ported from the web app's actual shipping source
 * (`apps/web/src/styles/tokens/*.css`) -- not `design-system/tokens/`, which
 * is stale: several values there (`--border-default`, `--warning`,
 * `--border-focus`) were fixed for WCAG AA contrast in the web app months
 * ago and never synced back to the design-system source. Porting from the
 * unfixed file would have reintroduced bugs the web app already paid to fix.
 * See TODO.md's "Resolve the five WCAG AA token contrast failures" entry.
 *
 * React Native has no CSS custom properties, so this flattens the source's
 * two-layer ramp -> semantic-alias structure into plain JS objects, kept in
 * the same two layers (`ramp` then `color`) so it stays diffable against the
 * CSS source by eye. Composite type roles (`--type-h1` etc.) are precomputed
 * here into ready-to-spread RN text style objects, since RN has no `font`
 * shorthand and expects `lineHeight` as an absolute dp value and
 * `letterSpacing` as an absolute value, not an em multiplier -- both
 * computed from the source's em/unitless values at each role's own font size.
 */

export const ramp = {
  clay50: '#FDF1EC', clay100: '#F8DFD4', clay200: '#F0C2AE', clay300: '#E39F82', clay400: '#D27C58',
  clay500: '#B55535', clay600: '#A94E2E', clay700: '#8B3E24', clay800: '#6B301C', clay900: '#4A2214',

  sand50: '#FDF6EA', sand100: '#F9E9CC', sand200: '#F2D49F', sand300: '#E8B96B', sand400: '#DDA046',
  sand500: '#C9862C', sand600: '#A66C21', sand700: '#7F521A',

  sable0: '#FFFFFF', sable25: '#FDFBF8', sable50: '#FBF7F2', sable100: '#F5EFE7', sable200: '#E9E1D6',
  sable300: '#D8CDBF', sable400: '#B4A798', sable500: '#8C8075', sable600: '#6E635C',
  sable700: '#4C443F', sable800: '#332D29', sable900: '#241F1C',

  atlas50: '#EAF3EF', atlas100: '#CBE3D8', atlas300: '#6FAE97', atlas500: '#35786A', atlas700: '#245349',

  saffron50: '#FEF5E0', saffron100: '#FBE6B4', saffron500: '#C98A16', saffron700: '#8F6108',

  rose50: '#FCEDEA', rose100: '#F7D5CE', rose500: '#B33A2B', rose700: '#87291D',

  majorelle50: '#EDF0FA', majorelle500: '#3F5AA6', majorelle700: '#2C3F78',
} as const;

export const color = {
  brand: ramp.clay500, brandHover: ramp.clay600, brandPress: ramp.clay700,
  brandSubtle: ramp.clay50, brandSubtleHover: ramp.clay100, brandBorder: ramp.clay200,
  brandSecondary: ramp.sand400, brandSecondarySubtle: ramp.sand50,

  bgPage: ramp.sable50, bgPageAlt: ramp.sable100, bgInset: ramp.sable100,
  surfaceCard: ramp.sable0, surfaceRaised: ramp.sable0, surfaceSunken: ramp.sable25,
  surfaceInverse: ramp.sable900, surfaceScrim: 'rgba(36,31,28,0.56)',

  textHeading: ramp.sable900, textBody: ramp.sable800, textMuted: ramp.sable600,
  textSubtle: ramp.sable600, textOnBrand: '#FFFFFF', textOnInverse: ramp.sable50,
  textLink: ramp.clay600, textLinkHover: ramp.clay700, textPrice: ramp.sable900,

  borderHairline: ramp.sable200, borderDefault: ramp.sable500, borderStrong: ramp.sable400,
  borderFocus: ramp.clay500,

  success: ramp.atlas500, successSubtle: ramp.atlas50, successBorder: ramp.atlas100,
  warning: ramp.saffron700, warningSubtle: ramp.saffron50, warningBorder: ramp.saffron100,
  danger: ramp.rose500, dangerSubtle: ramp.rose50, dangerBorder: ramp.rose100,
  info: ramp.majorelle500, infoSubtle: ramp.majorelle50,

  focusRing: ramp.clay500,
} as const;

/** 4px-derived, matching `--space-*` 1:1 (RN style numbers are already dp). */
export const space = {
  0: 0, 1: 4, 2: 6, 3: 8, 4: 12, 5: 16,
  6: 20, 7: 24, 8: 32, 9: 40, 10: 56, 11: 72, 12: 96,
} as const;

export const layout = {
  gutterMobile: 20,
  cardPad: 16, cardPadLg: 20,
  sectionGapMobile: 32,
  controlHSm: 36, controlHMd: 44, controlHLg: 52, tapMin: 44,
  navHMobile: 56, tabbarH: 64,
} as const;

export const radius = {
  xs: 6, sm: 10, md: 14, lg: 18, xl: 24, xxl: 32, pill: 999,
  card: 18, cardInner: 12, control: 12, chip: 999,
  sheet: 24, image: 14, avatar: 999,
} as const;

/**
 * Warm-tinted shadows (brown-black, never neutral grey), ported verbatim as
 * CSS `boxShadow` strings -- supported cross-platform on `View` since RN
 * 0.74 and the default on New Architecture (enabled here), so this needs no
 * per-platform `elevation`/`shadow*` prop split.
 */
export const shadow = {
  none: 'none',
  xs: '0 1px 2px rgba(58,42,32,0.06)',
  sm: '0 1px 3px rgba(58,42,32,0.07), 0 1px 2px rgba(58,42,32,0.04)',
  md: '0 4px 12px rgba(58,42,32,0.08), 0 1px 3px rgba(58,42,32,0.05)',
  lg: '0 12px 28px rgba(58,42,32,0.10), 0 2px 6px rgba(58,42,32,0.05)',
  sheet: '0 -8px 32px rgba(58,42,32,0.14)',
  brand: '0 6px 16px rgba(181,85,53,0.24)',
} as const;

export const duration = {
  instant: 80, fast: 140, med: 220, slow: 320, sheet: 420,
} as const;

const fontDisplay = 'PlusJakartaSans_800ExtraBold';
const fontDisplayBold = 'PlusJakartaSans_700Bold';
const fontUiRegular = 'PlusJakartaSans_400Regular';
const fontUiMedium = 'PlusJakartaSans_500Medium';
const fontUiSemibold = 'PlusJakartaSans_600SemiBold';
const fontUiBold = 'PlusJakartaSans_700Bold';

type TextRole = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  color: string;
};

/** em -> dp at a given font size, matching `--ls-*`'s em values. */
const ls = (em: number, size: number) => Math.round(em * size * 100) / 100;
/** unitless line-height multiplier -> dp, matching `--lh-*`. */
const lh = (multiplier: number, size: number) => Math.round(multiplier * size);

/**
 * Composite type roles, matching `--type-*` in typography.css. Each is a
 * ready-to-spread RN text style (`<Text style={type.h1}>`), not just a font
 * size -- RN has no shorthand, so this is the one place that math happens
 * rather than at every call site.
 */
export const type: Record<string, TextRole> = {
  display: { fontFamily: fontDisplay, fontSize: 32, lineHeight: lh(1.12, 32), letterSpacing: ls(-0.02, 32), color: color.textHeading },
  h1: { fontFamily: fontDisplayBold, fontSize: 28, lineHeight: lh(1.24, 28), letterSpacing: ls(-0.01, 28), color: color.textHeading },
  h2: { fontFamily: fontDisplayBold, fontSize: 22, lineHeight: lh(1.24, 22), letterSpacing: ls(-0.01, 22), color: color.textHeading },
  h3: { fontFamily: fontUiSemibold, fontSize: 18, lineHeight: lh(1.4, 18), letterSpacing: 0, color: color.textHeading },
  body: { fontFamily: fontUiRegular, fontSize: 15, lineHeight: lh(1.55, 15), letterSpacing: 0, color: color.textBody },
  bodySm: { fontFamily: fontUiRegular, fontSize: 13, lineHeight: lh(1.4, 13), letterSpacing: 0, color: color.textBody },
  bodyLg: { fontFamily: fontUiRegular, fontSize: 17, lineHeight: lh(1.55, 17), letterSpacing: 0, color: color.textBody },
  label: { fontFamily: fontUiSemibold, fontSize: 13, lineHeight: lh(1.4, 13), letterSpacing: 0, color: color.textHeading },
  caption: { fontFamily: fontUiMedium, fontSize: 12, lineHeight: lh(1.4, 12), letterSpacing: 0, color: color.textMuted },
  price: { fontFamily: fontUiBold, fontSize: 18, lineHeight: lh(1.4, 18), letterSpacing: 0, color: color.textPrice },
  eyebrow: { fontFamily: fontUiSemibold, fontSize: 11, lineHeight: lh(1.2, 11), letterSpacing: ls(0.08, 11), color: color.textMuted },
};

export const font = {
  display: fontDisplay,
  displayBold: fontDisplayBold,
  uiRegular: fontUiRegular,
  uiMedium: fontUiMedium,
  uiSemibold: fontUiSemibold,
  uiBold: fontUiBold,
  mono: 'IBMPlexMono_400Regular',
};
