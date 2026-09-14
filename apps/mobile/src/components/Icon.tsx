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
  EyeOff,
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
  UserRound,
  UsersRound,
  Wallet,
  Wifi,
  X,
  type LucideIcon,
} from 'lucide-react-native';

/**
 * Same slug registry as `apps/web/src/components/ds/Icon.tsx`, on
 * `lucide-react-native` instead of `lucide-react` -- same icon set, same
 * names, so markup ported from the web app (or the `ui_kits/` mockups)
 * needs no glyph-name translation. Keep the two registries in sync by hand;
 * there is no shared package between the two apps yet (see the mobile
 * scaffold's own commit message for why not).
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
  'eye-off': EyeOff,
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
  'user-round': UserRound,
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
  /** Override colour; defaults to currentColor via the theme's textHeading. */
  color?: string;
  /** Filled variants, used by the favourite heart and rating star. */
  fill?: string;
}

export function Icon({ name = 'home', size = 20, color = '#241F1C', fill }: IconProps) {
  const Glyph = GLYPHS[name];
  if (!Glyph) return null;

  return <Glyph size={size} color={color} fill={fill ?? 'none'} />;
}
