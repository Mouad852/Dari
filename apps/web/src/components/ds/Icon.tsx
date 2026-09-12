import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BatteryFull,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Eye,
  Flag,
  Heart,
  Info,
  KeyRound,
  List,
  LoaderCircle,
  Map as MapIcon,
  MapPin,
  MessageCircle,
  MessageSquareText,
  Pencil,
  Plus,
  Search,
  Send,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Signal,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  Type,
  UploadCloud,
  UsersRound,
  Wallet,
  Wifi,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { CSSProperties } from 'react';

/**
 * Lucide glyph, keyed by the same slug strings the design system uses.
 *
 * The v1 source fetched each glyph from unpkg at runtime as a CSS mask: a
 * network request per icon, nothing rendered server-side, and a hard dependency
 * on a CDN being reachable — worst of all on the slow mobile connections this
 * product targets. `src/components/ds/README.md` records the required rework,
 * and this is it: the glyphs are bundled from the `lucide-react` dependency the
 * app already carries, under the same names so markup copied out of the UI kits
 * works unchanged.
 *
 * An unknown name renders nothing rather than a broken glyph — the README is
 * explicit that a missing icon shows words, never a placeholder box.
 */
const GLYPHS: Record<string, LucideIcon> = {
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'arrow-up-right': ArrowUpRight,
  'battery-full': BatteryFull,
  check: Check,
  'check-circle-2': CheckCircle2,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'clock-3': Clock3,
  'external-link': ExternalLink,
  eye: Eye,
  flag: Flag,
  heart: Heart,
  info: Info,
  'key-round': KeyRound,
  list: List,
  'loader-circle': LoaderCircle,
  map: MapIcon,
  'map-pin': MapPin,
  'message-circle': MessageCircle,
  'message-square-text': MessageSquareText,
  pencil: Pencil,
  plus: Plus,
  search: Search,
  send: Send,
  'share-2': Share2,
  'shield-alert': ShieldAlert,
  'shield-check': ShieldCheck,
  signal: Signal,
  'sliders-horizontal': SlidersHorizontal,
  sparkles: Sparkles,
  star: Star,
  'trash-2': Trash2,
  type: Type,
  'upload-cloud': UploadCloud,
  'users-round': UsersRound,
  wallet: Wallet,
  wifi: Wifi,
  x: X,
};

export interface IconProps {
  /** Lucide slug, e.g. "map-pin", "heart", "shield-check". */
  name?: string;
  /** Pixel box (square). Default 20. */
  size?: number;
  /** Override colour; defaults to currentColor. */
  color?: string;
  /** Filled variants, used by the favourite heart and rating star. */
  fill?: string;
  style?: CSSProperties;
}

export function Icon({ name = 'home', size = 20, color = 'currentColor', fill, style }: IconProps) {
  const Glyph = GLYPHS[name];
  if (!Glyph) return null;

  return (
    <Glyph
      aria-hidden="true"
      size={size}
      color={color}
      fill={fill ?? 'none'}
      style={{ flex: '0 0 auto', ...style }}
    />
  );
}
