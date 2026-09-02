/* @ds-bundle: {"format":4,"namespace":"DariDesignSystem_d1bbe2","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"},{"name":"Dialog","sourcePath":"components/feedback/Dialog.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"Tooltip","sourcePath":"components/feedback/Tooltip.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Radio","sourcePath":"components/forms/Radio.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"ListingCard","sourcePath":"components/listings/ListingCard.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"c5aab0031481","components/core/Button.jsx":"0235d9ee76fd","components/core/Card.jsx":"54d993fd95c3","components/core/Icon.jsx":"92009ab78e4b","components/core/IconButton.jsx":"a0b12ef07c40","components/core/Tag.jsx":"4316925b2ebd","components/feedback/Dialog.jsx":"4cc51407e288","components/feedback/Toast.jsx":"48c368c94831","components/feedback/Tooltip.jsx":"07d8d0ea36a9","components/forms/Checkbox.jsx":"3aab07b88873","components/forms/Input.jsx":"f7767302daff","components/forms/Radio.jsx":"2f0e0f37c1fa","components/forms/Select.jsx":"ded3738de46d","components/forms/Switch.jsx":"3cbbf19676a4","components/listings/ListingCard.jsx":"5f5d1f82defa","components/navigation/Tabs.jsx":"0fd3f077a349","ui_kits/listing_detail/ListingDetail.jsx":"a1fdd728e777","ui_kits/mobile_app/AppShell.jsx":"82027cb61cdf","ui_kits/mobile_app/FeedScreen.jsx":"e70d8f9f246d","ui_kits/mobile_app/FiltersSheet.jsx":"4ed02adfbe39","ui_kits/mobile_app/ListingScreen.jsx":"d0ddd4872daa","ui_kits/mobile_app/MessagesScreen.jsx":"3e008c6cc294","ui_kits/mobile_app/ProfileScreen.jsx":"7b67e92c9351","ui_kits/website/HomePage.jsx":"dc54772a42e8","ui_kits/website/SearchResultsPage.jsx":"3107b84712a0","ui_kits/website/SiteChrome.jsx":"4efdc3421e83"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.DariDesignSystem_d1bbe2 = window.DariDesignSystem_d1bbe2 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Base surface: white, 18px radius, warm hairline + soft shadow. */
function Card({
  children,
  padding = 'var(--card-pad)',
  interactive = false,
  elevation = 'sm',
  onClick,
  style,
  ...rest
}) {
  const [h, setH] = React.useState(false);
  const sh = {
    none: 'none',
    xs: 'var(--shadow-xs)',
    sm: 'var(--shadow-sm)',
    md: 'var(--shadow-md)',
    lg: 'var(--shadow-lg)'
  }[elevation];
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-hairline)',
      borderRadius: 'var(--radius-card)',
      padding,
      boxShadow: interactive && h ? 'var(--shadow-md)' : sh,
      transform: interactive && h ? 'translateY(-2px)' : 'none',
      transition: `box-shadow var(--dur-med) var(--ease-standard),transform var(--dur-med) var(--ease-standard)`,
      cursor: interactive ? 'pointer' : 'default',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CDN = 'https://unpkg.com/lucide-static@0.441.0/icons/';
const cache = new Map();
function load(name) {
  if (!cache.has(name)) {
    cache.set(name, fetch(CDN + name + '.svg').then(r => r.ok ? r.text() : '').then(t => t.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '').trim()).catch(() => ''));
  }
  return cache.get(name);
}

/** Lucide glyph, inlined as SVG children so it inherits currentColor. */
function Icon({
  name = 'home',
  size = 20,
  strokeWidth = 2,
  color = 'currentColor',
  style,
  ...rest
}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    let live = true;
    load(name).then(markup => {
      if (live && ref.current) ref.current.innerHTML = markup;
    });
    return () => {
      live = false;
    };
  }, [name]);
  return /*#__PURE__*/React.createElement("svg", _extends({
    ref: ref,
    "aria-hidden": "true",
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    fill: "none",
    stroke: color,
    strokeWidth: strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      display: 'inline-block',
      flex: '0 0 auto',
      verticalAlign: 'middle',
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TONES = {
  brand: {
    bg: 'var(--brand-subtle)',
    fg: 'var(--clay-700)',
    bd: 'var(--brand-border)'
  },
  neutral: {
    bg: 'var(--sable-100)',
    fg: 'var(--text-muted)',
    bd: 'var(--border-hairline)'
  },
  success: {
    bg: 'var(--success-subtle)',
    fg: 'var(--atlas-700)',
    bd: 'var(--success-border)'
  },
  warning: {
    bg: 'var(--warning-subtle)',
    fg: 'var(--saffron-700)',
    bd: 'var(--warning-border)'
  },
  danger: {
    bg: 'var(--danger-subtle)',
    fg: 'var(--rose-700)',
    bd: 'var(--danger-border)'
  },
  inverse: {
    bg: 'var(--surface-inverse)',
    fg: 'var(--text-on-inverse)',
    bd: 'transparent'
  }
};

/** Small status marker — "Vérifié", "Nouveau", "Dernière chambre". */
function Badge({
  children,
  tone = 'brand',
  icon,
  size = 'md',
  style,
  ...rest
}) {
  const t = TONES[tone] || TONES.brand;
  const sm = size === 'sm';
  return /*#__PURE__*/React.createElement("span", _extends({}, rest, {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      whiteSpace: 'nowrap',
      flexShrink: 0,
      padding: sm ? '2px 8px' : '4px 10px',
      background: t.bg,
      color: t.fg,
      border: `1px solid ${t.bd}`,
      borderRadius: 'var(--radius-pill)',
      font: `var(--weight-semibold) ${sm ? 'var(--text-micro)' : 'var(--text-caption)'}/1.3 var(--font-ui)`,
      ...style
    }
  }), icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: sm ? 11 : 13
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SIZES = {
  sm: {
    h: 'var(--control-h-sm)',
    px: 14,
    fs: 'var(--text-body-sm)',
    gap: 6,
    icon: 16
  },
  md: {
    h: 'var(--control-h-md)',
    px: 20,
    fs: 'var(--text-body-md)',
    gap: 8,
    icon: 18
  },
  lg: {
    h: 'var(--control-h-lg)',
    px: 24,
    fs: 'var(--text-body-lg)',
    gap: 10,
    icon: 20
  }
};
const VARIANTS = {
  primary: {
    bg: 'var(--brand)',
    fg: 'var(--text-on-brand)',
    bd: 'transparent',
    hover: 'var(--brand-hover)',
    press: 'var(--brand-press)',
    shadow: 'var(--shadow-brand)'
  },
  secondary: {
    bg: 'var(--surface-card)',
    fg: 'var(--text-heading)',
    bd: 'var(--border-default)',
    hover: 'var(--sable-50)',
    press: 'var(--sable-100)',
    shadow: 'var(--shadow-xs)'
  },
  subtle: {
    bg: 'var(--brand-subtle)',
    fg: 'var(--clay-700)',
    bd: 'transparent',
    hover: 'var(--brand-subtle-hover)',
    press: 'var(--clay-200)',
    shadow: 'none'
  },
  ghost: {
    bg: 'transparent',
    fg: 'var(--text-body)',
    bd: 'transparent',
    hover: 'var(--sable-100)',
    press: 'var(--sable-200)',
    shadow: 'none'
  },
  danger: {
    bg: 'var(--danger)',
    fg: '#fff',
    bd: 'transparent',
    hover: 'var(--rose-700)',
    press: 'var(--rose-700)',
    shadow: 'none'
  }
};

/** Primary interactive control. Pill-shaped, warm-shadowed, 44px tall by default. */
function Button({
  children,
  variant = 'primary',
  size = 'md',
  iconLeft,
  iconRight,
  fullWidth = false,
  loading = false,
  disabled = false,
  onClick,
  style,
  ...rest
}) {
  const s = SIZES[size] || SIZES.md,
    v = VARIANTS[variant] || VARIANTS.primary;
  const [h, setH] = React.useState(false),
    [p, setP] = React.useState(false);
  const off = disabled || loading;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    disabled: off,
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => {
      setH(false);
      setP(false);
    },
    onMouseDown: () => setP(true),
    onMouseUp: () => setP(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s.gap,
      whiteSpace: 'nowrap',
      flexShrink: 0,
      height: s.h,
      padding: `0 ${s.px}px`,
      width: fullWidth ? '100%' : 'auto',
      font: `var(--weight-semibold) ${s.fs}/1 var(--font-ui)`,
      letterSpacing: '0em',
      color: v.fg,
      background: off ? 'var(--sable-200)' : p ? v.press : h ? v.hover : v.bg,
      border: `1px solid ${off ? 'transparent' : v.bd}`,
      borderRadius: 'var(--radius-pill)',
      boxShadow: off ? 'none' : h && variant === 'primary' ? 'var(--shadow-brand)' : v.shadow,
      transform: p && !off ? 'scale(var(--press-scale))' : 'none',
      cursor: off ? 'not-allowed' : 'pointer',
      transition: 'var(--transition-control)',
      opacity: off ? .75 : 1,
      ...style
    }
  }, rest), loading && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "loader-circle",
    size: s.icon,
    style: {
      animation: 'dari-spin 900ms linear infinite'
    }
  }), !loading && iconLeft && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconLeft,
    size: s.icon
  }), children != null && children !== false && /*#__PURE__*/React.createElement("span", {
    style: {
      whiteSpace: 'nowrap',
      flexShrink: 0
    }
  }, children), !loading && iconRight && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconRight,
    size: s.icon
  }));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const S = {
  sm: 36,
  md: 44,
  lg: 52
};

/** Circular icon-only control — favourites, close, back, share. */
function IconButton({
  icon = 'heart',
  size = 'md',
  variant = 'secondary',
  active = false,
  label,
  onClick,
  style,
  ...rest
}) {
  const d = S[size] || 44;
  const [h, setH] = React.useState(false),
    [p, setP] = React.useState(false);
  const looks = {
    secondary: {
      bg: 'var(--surface-card)',
      fg: 'var(--text-heading)',
      bd: 'var(--border-hairline)',
      sh: 'var(--shadow-sm)'
    },
    glass: {
      bg: 'var(--surface-glass)',
      fg: 'var(--sable-900)',
      bd: 'rgba(255,255,255,.6)',
      sh: 'var(--shadow-sm)'
    },
    ghost: {
      bg: 'transparent',
      fg: 'var(--text-body)',
      bd: 'transparent',
      sh: 'none'
    },
    brand: {
      bg: 'var(--brand)',
      fg: '#fff',
      bd: 'transparent',
      sh: 'var(--shadow-brand)'
    }
  }[variant] || {};
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": label || icon,
    "aria-pressed": active,
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => {
      setH(false);
      setP(false);
    },
    onMouseDown: () => setP(true),
    onMouseUp: () => setP(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: d,
      height: d,
      borderRadius: 'var(--radius-pill)',
      border: `1px solid ${looks.bd}`,
      background: looks.bg,
      color: active ? 'var(--brand)' : looks.fg,
      boxShadow: looks.sh,
      cursor: 'pointer',
      backdropFilter: variant === 'glass' ? 'var(--blur-glass)' : undefined,
      transform: p ? 'scale(var(--press-scale))' : h ? 'scale(1.03)' : 'none',
      transition: 'var(--transition-control)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: size === 'sm' ? 16 : size === 'lg' ? 24 : 20,
    style: active ? {
      filter: 'none'
    } : undefined
  }));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Selectable filter chip / amenity tag. */
function Tag({
  children,
  icon,
  selected = false,
  removable = false,
  onClick,
  onRemove,
  style,
  ...rest
}) {
  const [h, setH] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 36,
      padding: '0 14px',
      flexShrink: 0,
      whiteSpace: 'nowrap',
      background: selected ? 'var(--sable-900)' : h ? 'var(--sable-100)' : 'var(--surface-card)',
      color: selected ? 'var(--text-on-inverse)' : 'var(--text-body)',
      border: `1px solid ${selected ? 'var(--sable-900)' : 'var(--border-hairline)'}`,
      borderRadius: 'var(--radius-chip)',
      font: 'var(--weight-medium) var(--text-body-sm)/1 var(--font-ui)',
      cursor: 'pointer',
      transition: 'var(--transition-control)',
      ...style
    }
  }, rest), icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 15
  }), children, removable && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "x",
    size: 14,
    style: {
      opacity: .6,
      marginLeft: 2
    },
    onClick: e => {
      e.stopPropagation();
      onRemove && onRemove();
    }
  }));
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Dialog.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Modal dialog — centred card on desktop, bottom sheet on mobile.
 *  Viewport-fixed by default; pass `contained` to clip inside a positioned ancestor (e.g. a phone frame). */
function Dialog({
  open = true,
  title,
  children,
  footer,
  onClose,
  sheet = false,
  contained = false,
  width = 440,
  style,
  ...rest
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: contained ? 'absolute' : 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: sheet ? 'flex-end' : 'center',
      justifyContent: 'center',
      background: 'var(--surface-scrim)',
      backdropFilter: 'blur(2px)',
      padding: sheet ? 0 : 'var(--space-5)',
      zIndex: 50
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", _extends({
    role: "dialog",
    "aria-modal": "true",
    onClick: e => e.stopPropagation(),
    style: {
      width: sheet ? '100%' : width,
      maxWidth: '100%',
      background: 'var(--surface-card)',
      borderRadius: sheet ? 'var(--radius-sheet) var(--radius-sheet) 0 0' : 'var(--radius-xl)',
      boxShadow: sheet ? 'var(--shadow-sheet)' : 'var(--shadow-lg)',
      animation: sheet ? 'dari-sheet-in var(--dur-sheet) var(--ease-out)' : 'dari-pop-in var(--dur-med) var(--ease-out)',
      overflow: 'hidden',
      ...style
    }
  }, rest), sheet && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      paddingTop: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 40,
      height: 4,
      borderRadius: 'var(--radius-pill)',
      background: 'var(--sable-300)'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 'var(--space-4)',
      padding: 'var(--space-6) var(--space-6) var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      flex: 1,
      font: 'var(--type-h2)'
    }
  }, title), onClose && /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "x",
    size: "sm",
    variant: "ghost",
    label: "Fermer",
    onClick: onClose
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 var(--space-6)',
      font: 'var(--type-body)',
      color: 'var(--text-body)'
    }
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-4)',
      justifyContent: 'flex-end',
      padding: 'var(--space-6)',
      marginTop: 'var(--space-5)'
    }
  }, footer)));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TONES = {
  neutral: {
    bg: 'var(--surface-inverse)',
    fg: 'var(--text-on-inverse)',
    icon: 'info'
  },
  success: {
    bg: 'var(--atlas-500)',
    fg: '#fff',
    icon: 'check'
  },
  danger: {
    bg: 'var(--rose-500)',
    fg: '#fff',
    icon: 'triangle-alert'
  }
};

/** Transient confirmation, bottom-anchored above the tab bar. */
function Toast({
  children,
  tone = 'neutral',
  icon,
  action,
  onAction,
  style,
  ...rest
}) {
  const t = TONES[tone] || TONES.neutral;
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "status",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--space-4)',
      padding: '12px 16px',
      background: t.bg,
      color: t.fg,
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-lg)',
      font: 'var(--weight-medium) var(--text-body-sm)/1.4 var(--font-ui)',
      animation: 'dari-toast-in var(--dur-med) var(--ease-out)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon || t.icon,
    size: 18
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, children), action && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onAction,
    style: {
      border: 'none',
      background: 'transparent',
      color: 'inherit',
      font: 'var(--weight-bold) var(--text-body-sm)/1 var(--font-ui)',
      textDecoration: 'underline',
      cursor: 'pointer',
      padding: 0
    }
  }, action));
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tooltip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Hover/focus hint on desktop. On mobile, prefer helper text. */
function Tooltip({
  label,
  children,
  placement = 'top',
  style,
  ...rest
}) {
  const [on, setOn] = React.useState(false);
  const pos = placement === 'bottom' ? {
    top: 'calc(100% + 8px)'
  } : {
    bottom: 'calc(100% + 8px)'
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      position: 'relative',
      display: 'inline-flex',
      ...style
    },
    onMouseEnter: () => setOn(true),
    onMouseLeave: () => setOn(false),
    onFocus: () => setOn(true),
    onBlur: () => setOn(false)
  }, rest), children, on && /*#__PURE__*/React.createElement("span", {
    role: "tooltip",
    style: {
      position: 'absolute',
      left: '50%',
      transform: 'translateX(-50%)',
      ...pos,
      whiteSpace: 'nowrap',
      padding: '6px 10px',
      background: 'var(--surface-inverse)',
      color: 'var(--text-on-inverse)',
      borderRadius: 'var(--radius-xs)',
      font: 'var(--type-caption)',
      boxShadow: 'var(--shadow-md)',
      animation: 'dari-pop-in var(--dur-fast) var(--ease-out)',
      zIndex: 20
    }
  }, label));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Square 22px checkbox with terracotta fill when checked. */
function Checkbox({
  label,
  checked = false,
  onChange,
  description,
  disabled = false,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: description ? 'flex-start' : 'center',
      gap: 'var(--space-4)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? .6 : 1,
      minHeight: 'var(--tap-min)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    checked: checked,
    onChange: onChange,
    disabled: disabled,
    style: {
      position: 'absolute',
      opacity: 0,
      width: 0,
      height: 0
    }
  }, rest)), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: '0 0 auto',
      width: 22,
      height: 22,
      marginTop: description ? 2 : 0,
      borderRadius: 'var(--radius-xs)',
      background: checked ? 'var(--brand)' : 'var(--surface-card)',
      border: `1px solid ${checked ? 'var(--brand)' : 'var(--border-default)'}`,
      boxShadow: 'var(--shadow-xs)',
      transition: 'var(--transition-control)'
    }
  }, checked && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: 15,
    color: "#fff"
  })), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--type-body)',
      color: 'var(--text-heading)'
    }
  }, label), description && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--type-caption)',
      color: 'var(--text-muted)',
      marginTop: 2
    }
  }, description)));
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Text field with warm inset surface, optional leading icon, label and helper text. */
function Input({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  iconLeft,
  suffix,
  error,
  helper,
  disabled = false,
  size = 'md',
  style,
  ...rest
}) {
  const [foc, setFoc] = React.useState(false);
  const h = size === 'lg' ? 'var(--control-h-lg)' : size === 'sm' ? 'var(--control-h-sm)' : 'var(--control-h-md)';
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--type-label)',
      color: 'var(--text-heading)',
      marginBottom: 'var(--space-2)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      height: h,
      padding: '0 14px',
      background: disabled ? 'var(--sable-100)' : 'var(--surface-card)',
      border: `1px solid ${error ? 'var(--danger)' : foc ? 'var(--border-focus)' : 'var(--border-hairline)'}`,
      borderRadius: 'var(--radius-control)',
      boxShadow: foc ? 'var(--focus-ring)' : 'var(--shadow-xs)',
      transition: 'var(--transition-control)'
    }
  }, iconLeft && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconLeft,
    size: 18,
    color: "var(--text-subtle)"
  }), /*#__PURE__*/React.createElement("input", _extends({
    type: type,
    value: value,
    placeholder: placeholder,
    disabled: disabled,
    onChange: onChange,
    onFocus: () => setFoc(true),
    onBlur: () => setFoc(false),
    style: {
      flex: 1,
      minWidth: 0,
      border: 'none',
      outline: 'none',
      background: 'transparent',
      font: 'var(--type-body)',
      color: 'var(--text-heading)'
    }
  }, rest)), suffix && /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--text-muted)'
    }
  }, suffix)), (error || helper) && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      marginTop: 'var(--space-2)',
      font: 'var(--type-caption)',
      color: error ? 'var(--danger)' : 'var(--text-muted)'
    }
  }, error || helper));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Radio.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Single-choice control; use inside a labelled group. */
function Radio({
  label,
  description,
  checked = false,
  onChange,
  name,
  value,
  disabled = false,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: description ? 'flex-start' : 'center',
      gap: 'var(--space-4)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? .6 : 1,
      minHeight: 'var(--tap-min)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "radio",
    name: name,
    value: value,
    checked: checked,
    onChange: onChange,
    disabled: disabled,
    style: {
      position: 'absolute',
      opacity: 0,
      width: 0,
      height: 0
    }
  }, rest)), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: '0 0 auto',
      width: 22,
      height: 22,
      marginTop: description ? 2 : 0,
      borderRadius: 'var(--radius-pill)',
      background: 'var(--surface-card)',
      border: `1px solid ${checked ? 'var(--brand)' : 'var(--border-default)'}`,
      boxShadow: 'var(--shadow-xs)',
      transition: 'var(--transition-control)'
    }
  }, checked && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 11,
      height: 11,
      borderRadius: 'var(--radius-pill)',
      background: 'var(--brand)'
    }
  })), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--type-body)',
      color: 'var(--text-heading)'
    }
  }, label), description && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--type-caption)',
      color: 'var(--text-muted)',
      marginTop: 2
    }
  }, description)));
}
Object.assign(__ds_scope, { Radio });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Radio.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Native select styled to match Input. */
function Select({
  label,
  options = [],
  value,
  onChange,
  placeholder = 'Choisir…',
  helper,
  disabled = false,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--type-label)',
      color: 'var(--text-heading)',
      marginBottom: 'var(--space-2)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'block'
    }
  }, /*#__PURE__*/React.createElement("select", _extends({
    value: value,
    onChange: onChange,
    disabled: disabled,
    style: {
      appearance: 'none',
      width: '100%',
      height: 'var(--control-h-md)',
      padding: '0 40px 0 14px',
      background: disabled ? 'var(--sable-100)' : 'var(--surface-card)',
      border: '1px solid var(--border-hairline)',
      borderRadius: 'var(--radius-control)',
      boxShadow: 'var(--shadow-xs)',
      font: 'var(--type-body)',
      color: value ? 'var(--text-heading)' : 'var(--text-subtle)',
      cursor: 'pointer'
    }
  }, rest), /*#__PURE__*/React.createElement("option", {
    value: ""
  }, placeholder), options.map(o => {
    const v = typeof o === 'string' ? o : o.value,
      l = typeof o === 'string' ? o : o.label;
    return /*#__PURE__*/React.createElement("option", {
      key: v,
      value: v
    }, l);
  })), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: 18,
    color: "var(--text-muted)",
    style: {
      position: 'absolute',
      right: 14,
      top: '50%',
      transform: 'translateY(-50%)',
      pointerEvents: 'none'
    }
  })), helper && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      marginTop: 'var(--space-2)',
      font: 'var(--type-caption)',
      color: 'var(--text-muted)'
    }
  }, helper));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Instant-apply toggle — settings and filter refinements. */
function Switch({
  label,
  description,
  checked = false,
  onChange,
  disabled = false,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 'var(--space-5)',
      minHeight: 'var(--tap-min)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? .6 : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--type-body)',
      color: 'var(--text-heading)'
    }
  }, label), description && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--type-caption)',
      color: 'var(--text-muted)',
      marginTop: 2
    }
  }, description)), /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    role: "switch",
    checked: checked,
    onChange: onChange,
    disabled: disabled,
    style: {
      position: 'absolute',
      opacity: 0,
      width: 0,
      height: 0
    }
  }, rest)), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: '0 0 auto',
      position: 'relative',
      width: 48,
      height: 28,
      borderRadius: 'var(--radius-pill)',
      background: checked ? 'var(--brand)' : 'var(--sable-300)',
      boxShadow: 'inset 0 1px 2px rgba(58,42,32,.12)',
      transition: `background-color var(--dur-med) var(--ease-standard)`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 3,
      left: checked ? 23 : 3,
      width: 22,
      height: 22,
      borderRadius: 'var(--radius-pill)',
      background: '#fff',
      boxShadow: 'var(--shadow-sm)',
      transition: `left var(--dur-med) var(--ease-out)`
    }
  })));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/listings/ListingCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** The product's signature card: photo, price, location, flatmate meta. */
function ListingCard({
  image,
  title,
  city,
  district,
  price,
  period = 'mois',
  badge,
  badgeTone = 'brand',
  flatmates,
  rating,
  saved = false,
  onSave,
  onClick,
  layout = 'vertical',
  style,
  ...rest
}) {
  const [h, setH] = React.useState(false);
  const row = layout === 'horizontal';
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      display: 'flex',
      flexDirection: row ? 'row' : 'column',
      gap: row ? 'var(--space-4)' : 0,
      background: 'var(--surface-card)',
      border: '1px solid var(--border-hairline)',
      borderRadius: 'var(--radius-card)',
      overflow: 'hidden',
      cursor: 'pointer',
      boxShadow: h ? 'var(--shadow-md)' : 'var(--shadow-sm)',
      transform: h ? 'translateY(-2px)' : 'none',
      transition: 'box-shadow var(--dur-med) var(--ease-standard),transform var(--dur-med) var(--ease-standard)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      flex: row ? '0 0 116px' : 'none',
      aspectRatio: row ? '1 / 1' : '4 / 3',
      background: image ? `center/cover no-repeat url(${image})` : 'var(--sable-200)',
      borderRadius: row ? 'var(--radius-card-inner)' : 0,
      margin: row ? 'var(--space-4) 0 var(--space-4) var(--space-4)' : 0
    }
  }, !image && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--sable-400)',
      font: 'var(--type-caption)',
      letterSpacing: 'var(--ls-caps)',
      textTransform: 'uppercase'
    }
  }, "Photo"), !row && image && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--scrim-image)'
    }
  }), badge && /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: badgeTone,
    size: "sm",
    style: {
      position: 'absolute',
      top: 10,
      left: 10,
      background: 'var(--surface-glass)',
      backdropFilter: 'var(--blur-glass)',
      border: 'none'
    }
  }, badge), !row && /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "heart",
    variant: "glass",
    size: "sm",
    active: saved,
    label: "Enregistrer",
    onClick: e => {
      e.stopPropagation();
      onSave && onSave();
    },
    style: {
      position: 'absolute',
      top: 8,
      right: 8
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      padding: row ? 'var(--space-4) var(--space-4) var(--space-4) 0' : 'var(--card-pad)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      flex: 1,
      minWidth: 0,
      font: 'var(--type-h3)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, title), rating != null && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      font: 'var(--type-caption)',
      color: 'var(--text-body)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "star",
    size: 13,
    color: "var(--sand-400)"
  }), rating)), /*#__PURE__*/React.createElement("p", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
      font: 'var(--type-caption)',
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "map-pin",
    size: 13
  }), district ? `${district}, ${city}` : city), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 'var(--space-4)',
      marginTop: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-price)',
      color: 'var(--text-price)',
      whiteSpace: 'nowrap',
      flexShrink: 0
    }
  }, price, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--text-muted)',
      marginLeft: 4
    }
  }, "MAD/", period)), flatmates && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      font: 'var(--type-caption)',
      color: 'var(--text-muted)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "users-round",
    size: 13
  }), flatmates))));
}
Object.assign(__ds_scope, { ListingCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/listings/ListingCard.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Underlined tab bar for switching content sections. */
function Tabs({
  tabs = [],
  value,
  onChange,
  variant = 'underline',
  style,
  ...rest
}) {
  const items = tabs.map(t => typeof t === 'string' ? {
    value: t,
    label: t
  } : t);
  const active = value ?? items[0]?.value;
  if (variant === 'segmented') {
    return /*#__PURE__*/React.createElement("div", _extends({
      role: "tablist",
      style: {
        display: 'inline-flex',
        gap: 4,
        padding: 4,
        background: 'var(--bg-inset)',
        borderRadius: 'var(--radius-pill)',
        ...style
      }
    }, rest), items.map(t => {
      const on = t.value === active;
      return /*#__PURE__*/React.createElement("button", {
        key: t.value,
        role: "tab",
        "aria-selected": on,
        onClick: () => onChange && onChange(t.value),
        style: {
          height: 36,
          padding: '0 16px',
          border: 'none',
          borderRadius: 'var(--radius-pill)',
          background: on ? 'var(--surface-card)' : 'transparent',
          boxShadow: on ? 'var(--shadow-xs)' : 'none',
          color: on ? 'var(--text-heading)' : 'var(--text-muted)',
          font: `var(--weight-semibold) var(--text-body-sm)/1 var(--font-ui)`,
          cursor: 'pointer',
          transition: 'var(--transition-control)'
        }
      }, t.label);
    }));
  }
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "tablist",
    style: {
      display: 'flex',
      gap: 'var(--space-7)',
      borderBottom: '1px solid var(--border-hairline)',
      ...style
    }
  }, rest), items.map(t => {
    const on = t.value === active;
    return /*#__PURE__*/React.createElement("button", {
      key: t.value,
      role: "tab",
      "aria-selected": on,
      onClick: () => onChange && onChange(t.value),
      style: {
        position: 'relative',
        padding: '0 0 12px',
        border: 'none',
        background: 'transparent',
        color: on ? 'var(--text-heading)' : 'var(--text-muted)',
        font: `var(--weight-semibold) var(--text-body-md)/1.2 var(--font-ui)`,
        cursor: 'pointer',
        boxShadow: on ? 'inset 0 -2px 0 var(--brand)' : 'none',
        transition: 'var(--transition-control)'
      }
    }, t.label, t.count != null && /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 6,
        font: 'var(--type-caption)',
        color: 'var(--text-subtle)'
      }
    }, t.count));
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/listing_detail/ListingDetail.jsx
try { (() => {
const {
  Icon,
  Badge,
  Button,
  IconButton,
  Tag,
  Card
} = window.DariDesignSystem_d1bbe2;
const P = '../../assets/photos/';
const SHOTS = [{
  src: P + 'salon-agdal-4x3.jpg'
}, {
  src: P + 'salon-hassan-4x3.jpg'
}, {
  src: P + 'loft-gauthier-4x3.jpg'
}, {
  src: P + 'cuisine-medina-4x3.jpg'
}, {
  src: P + 'studio-malabata-4x3.jpg'
}, {
  src: P + 'sejour-hayriad-4x3.jpg'
}, {
  src: null
}, {
  src: null
}];
const AMENITIES = [['wifi', 'Wi-Fi fibre'], ['washing-machine', 'Lave-linge'], ['utensils', 'Cuisine équipée'], ['air-vent', 'Climatisation'], ['sun', 'Terrasse partagée'], ['car', 'Parking en rue'], ['tv', 'Salon avec TV'], ['building-2', 'Ascenseur']];
const RULES = [['cigarette-off', 'Non-fumeur à l’intérieur'], ['dog', 'Animaux acceptés'], ['users-round', 'Invités bienvenus'], ['moon', 'Calme de 22 h à 8 h']];
function Slide({
  shot
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "dari-slide"
  }, shot.src ? /*#__PURE__*/React.createElement("div", {
    className: "dari-slide-img",
    style: {
      backgroundImage: `url(${shot.src})`
    }
  }) : /*#__PURE__*/React.createElement("div", {
    className: "dari-slide-ph"
  }, "Photo"));
}
function Gallery() {
  const [i, setI] = React.useState(0);
  const rail = React.useRef(null);
  const onScroll = () => {
    const el = rail.current;
    if (!el) return;
    setI(Math.round(el.scrollLeft / el.clientWidth));
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "dari-gallery"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dari-rail",
    ref: rail,
    onScroll: onScroll
  }, SHOTS.map((s, n) => /*#__PURE__*/React.createElement(Slide, {
    key: n,
    shot: s
  }))), /*#__PURE__*/React.createElement("div", {
    className: "dari-gallery-top"
  }, /*#__PURE__*/React.createElement(IconButton, {
    icon: "chevron-left",
    variant: "glass",
    label: "Retour"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    icon: "share-2",
    variant: "glass",
    label: "Partager"
  }), /*#__PURE__*/React.createElement(IconButton, {
    icon: "heart",
    variant: "glass",
    label: "Enregistrer"
  }))), /*#__PURE__*/React.createElement("span", {
    className: "dari-count"
  }, i + 1, "/", SHOTS.length), /*#__PURE__*/React.createElement("div", {
    className: "dari-dots"
  }, SHOTS.map((_, n) => /*#__PURE__*/React.createElement("span", {
    key: n,
    style: {
      width: n === i ? 16 : 5,
      height: 5,
      borderRadius: 'var(--radius-pill)',
      background: n === i ? 'var(--sable-0)' : 'rgba(255,255,255,.55)',
      transition: 'width var(--dur-med) var(--ease-standard)'
    }
  }))));
}

/* Desktop-only mosaic; the rail above is hidden at >=1200 by CSS. */
function Mosaic() {
  return /*#__PURE__*/React.createElement("div", {
    className: "dari-mosaic"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dari-m-big",
    style: {
      backgroundImage: `url(${SHOTS[0].src})`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "dari-gallery-top"
  }, /*#__PURE__*/React.createElement(IconButton, {
    icon: "chevron-left",
    variant: "glass",
    label: "Retour"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    icon: "share-2",
    variant: "glass",
    label: "Partager"
  }), /*#__PURE__*/React.createElement(IconButton, {
    icon: "heart",
    variant: "glass",
    label: "Enregistrer"
  })))), SHOTS.slice(1, 5).map((s, n) => /*#__PURE__*/React.createElement("div", {
    key: n,
    className: "dari-m-cell",
    style: s.src ? {
      backgroundImage: `url(${s.src})`
    } : {}
  }, !s.src && /*#__PURE__*/React.createElement("span", {
    className: "dari-ph-label"
  }, "Photo"))), /*#__PURE__*/React.createElement("span", {
    className: "dari-count dari-count-mosaic"
  }, "1/", SHOTS.length));
}
function SectionTitle({
  children
}) {
  return /*#__PURE__*/React.createElement("h2", {
    style: {
      font: 'var(--type-h2)',
      color: 'var(--text-heading)',
      margin: 0
    }
  }, children);
}
function RoomBreakdown() {
  const rooms = [['bed-double', '2 chambres', 'dont une avec balcon'], ['sofa', 'Salon', 'utilisable comme 3ᵉ couchage'], ['bath', '1 salle de bain', 'plus WC séparé']];
  return /*#__PURE__*/React.createElement(Card, {
    padding: "var(--card-pad-lg)",
    style: {
      display: 'grid',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-h3)',
      color: 'var(--text-heading)'
    }
  }, "2 chambres + salon"), /*#__PURE__*/React.createElement("div", {
    className: "dari-rooms"
  }, rooms.map(([ic, t, sub]) => /*#__PURE__*/React.createElement("span", {
    key: t,
    style: {
      display: 'flex',
      gap: 'var(--space-3)',
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 20,
    color: "var(--text-muted)",
    style: {
      marginTop: 2
    }
  }), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--type-label)',
      color: 'var(--text-heading)'
    }
  }, t), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--type-caption)',
      color: 'var(--text-muted)',
      marginTop: 2
    }
  }, sub))))), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 'var(--space-3)',
      alignItems: 'center',
      paddingTop: 'var(--space-4)',
      borderTop: '1px solid var(--border-hairline)',
      font: 'var(--type-body-sm)',
      color: 'var(--text-body)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sofa",
    size: 18,
    color: "var(--text-muted)"
  }), "Le salon sert de chambre suppl\xE9mentaire \u2014 la chambre propos\xE9e ici est priv\xE9e."));
}
function ContactPanel({
  variant
}) {
  return /*#__PURE__*/React.createElement(Card, {
    padding: "var(--card-pad-lg)",
    style: {
      display: 'grid',
      gap: 'var(--space-5)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--weight-bold) 26px/1.2 var(--font-ui)',
      color: 'var(--text-price)'
    }
  }, "3 200", /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--text-muted)',
      marginLeft: 6
    }
  }, "MAD/mois")), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      marginTop: 4,
      font: 'var(--type-caption)',
      color: 'var(--text-muted)'
    }
  }, "Charges comprises \xB7 caution 1 mois")), /*#__PURE__*/React.createElement(Button, {
    fullWidth: true,
    size: "lg",
    iconLeft: "message-circle"
  }, "Contacter"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 'var(--space-3)',
      alignItems: 'center',
      font: 'var(--type-caption)',
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield-check",
    size: 16,
    color: "var(--success)"
  }), "Paiement de la caution prot\xE9g\xE9 par Dari"));
}
function ListingDetail() {
  return /*#__PURE__*/React.createElement("div", {
    className: "dari-page"
  }, /*#__PURE__*/React.createElement(Gallery, null), /*#__PURE__*/React.createElement(Mosaic, null), /*#__PURE__*/React.createElement("div", {
    className: "dari-body"
  }, /*#__PURE__*/React.createElement("main", {
    className: "dari-main"
  }, /*#__PURE__*/React.createElement("section", {
    style: {
      display: 'grid',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "success",
    icon: "shield-check"
  }, "Annonce v\xE9rifi\xE9e"), /*#__PURE__*/React.createElement(Badge, {
    tone: "neutral",
    size: "sm"
  }, "Disponible 1er septembre")), /*#__PURE__*/React.createElement("h1", {
    style: {
      font: 'var(--type-h1)',
      color: 'var(--text-heading)',
      margin: 0
    }
  }, "Chambre lumineuse dans un 2 chambres + salon"), /*#__PURE__*/React.createElement("span", {
    className: "dari-price-row"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-bold) 24px/1.2 var(--font-ui)',
      color: 'var(--text-price)',
      whiteSpace: 'nowrap'
    }
  }, "3 200", /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--text-muted)',
      marginLeft: 6
    }
  }, "MAD/mois")), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--text-muted)'
    }
  }, "charges comprises"))), /*#__PURE__*/React.createElement("section", {
    style: {
      display: 'grid',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement(SectionTitle, null, "Emplacement"), /*#__PURE__*/React.createElement(Card, {
    padding: "0",
    style: {
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "dari-area"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dari-area-blob"
  }), /*#__PURE__*/React.createElement("span", {
    className: "dari-area-label"
  }, "Quartier Agdal")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--card-pad)',
      display: 'grid',
      gap: 'var(--space-2)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 6,
      alignItems: 'center',
      font: 'var(--type-label)',
      color: 'var(--text-heading)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "map-pin",
    size: 16,
    color: "var(--text-muted)"
  }), "Agdal, Rabat"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--text-muted)'
    }
  }, "Emplacement approximatif. L\u2019adresse exacte est communiqu\xE9e une fois la demande accept\xE9e.")))), /*#__PURE__*/React.createElement("section", {
    style: {
      display: 'grid',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement(SectionTitle, null, "Le logement"), /*#__PURE__*/React.createElement(RoomBreakdown, null), /*#__PURE__*/React.createElement(Card, {
    padding: "var(--card-pad-lg)",
    style: {
      display: 'flex',
      gap: 'var(--space-4)',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      width: 44,
      height: 44,
      flex: '0 0 auto',
      borderRadius: 'var(--radius-pill)',
      background: 'var(--brand-subtle)',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--brand)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bed-double",
    size: 20
  })), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--type-label)',
      color: 'var(--text-heading)'
    }
  }, "Enti\xE8rement meubl\xE9"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--type-caption)',
      color: 'var(--text-muted)',
      marginTop: 2
    }
  }, "Lit double, armoire, bureau et rangements fournis.")))), /*#__PURE__*/React.createElement("section", {
    style: {
      display: 'grid',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement(SectionTitle, null, "\xC9quipements"), /*#__PURE__*/React.createElement("div", {
    className: "dari-amenities"
  }, AMENITIES.map(([ic, label]) => /*#__PURE__*/React.createElement("span", {
    key: label,
    style: {
      display: 'flex',
      gap: 'var(--space-3)',
      alignItems: 'center',
      font: 'var(--type-body-sm)',
      color: 'var(--text-body)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 18,
    color: "var(--text-muted)"
  }), label)))), /*#__PURE__*/React.createElement("section", {
    style: {
      display: 'grid',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement(SectionTitle, null, "R\xE8gles de la colocation"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-3)',
      flexWrap: 'wrap'
    }
  }, RULES.map(([ic, label]) => /*#__PURE__*/React.createElement(Tag, {
    key: label,
    icon: ic
  }, label)))), /*#__PURE__*/React.createElement("section", {
    style: {
      display: 'grid',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement(SectionTitle, null, "Propri\xE9taire"), /*#__PURE__*/React.createElement(Card, {
    padding: "var(--card-pad-lg)",
    style: {
      display: 'flex',
      gap: 'var(--space-4)',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 48,
      height: 48,
      flex: '0 0 auto',
      borderRadius: 'var(--radius-avatar)',
      background: 'var(--clay-100)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: 'var(--weight-bold) 17px/1 var(--font-ui)',
      color: 'var(--clay-700)'
    }
  }, "N"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--type-label)',
      color: 'var(--text-heading)'
    }
  }, "Nadia"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--type-caption)',
      color: 'var(--text-muted)',
      marginTop: 2
    }
  }, "R\xE9pond en moyenne en 2 h")), /*#__PURE__*/React.createElement(Badge, {
    tone: "success",
    size: "sm",
    icon: "shield-check"
  }, "Identit\xE9 v\xE9rifi\xE9e")))), /*#__PURE__*/React.createElement("aside", {
    className: "dari-aside"
  }, /*#__PURE__*/React.createElement(ContactPanel, null))), /*#__PURE__*/React.createElement("div", {
    className: "dari-sticky"
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--weight-bold) 17px/1.2 var(--font-ui)',
      color: 'var(--text-price)',
      whiteSpace: 'nowrap'
    }
  }, "3 200 MAD"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--type-caption)',
      color: 'var(--text-muted)'
    }
  }, "par mois")), /*#__PURE__*/React.createElement(Button, {
    iconLeft: "message-circle",
    style: {
      marginLeft: 'auto'
    }
  }, "Contacter")));
}
Object.assign(window, {
  ListingDetail
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/listing_detail/ListingDetail.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile_app/AppShell.jsx
try { (() => {
const __DS = window.DariDesignSystem_d1bbe2 || window.__dsMissingBanner || (window.__dsMissingBanner = (() => {
  const d = document.createElement('div');
  d.textContent = 'Design-system bundle not loaded (_ds_bundle.js) — components unavailable.';
  d.style.cssText = 'position:fixed;inset:auto 0 0 0;z-index:999;padding:12px 20px;background:#B33A2B;color:#fff;font:600 13px/1.4 system-ui,sans-serif;text-align:center';
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(d));
  return new Proxy({}, {
    get: () => function Missing() {
      return null;
    }
  });
})());
const {
  Icon
} = __DS;
function StatusBar() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 44,
      padding: '0 22px',
      font: 'var(--weight-semibold) 13px/1 var(--font-ui)',
      color: 'var(--text-heading)'
    }
  }, /*#__PURE__*/React.createElement("span", null, "9:41"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 5,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "signal",
    size: 14
  }), /*#__PURE__*/React.createElement(Icon, {
    name: "wifi",
    size: 14
  }), /*#__PURE__*/React.createElement(Icon, {
    name: "battery-full",
    size: 16
  })));
}
function TopBar({
  title,
  onBack,
  action
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-4)',
      height: 'var(--nav-h-mobile)',
      padding: '0 var(--gutter-mobile)',
      background: 'var(--surface-card)',
      borderBottom: '1px solid var(--border-hairline)'
    }
  }, onBack && /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    "aria-label": "Retour",
    style: {
      border: 'none',
      background: 'transparent',
      padding: 0,
      cursor: 'pointer',
      display: 'flex',
      color: 'var(--text-heading)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-left",
    size: 24
  })), /*#__PURE__*/React.createElement("h1", {
    style: {
      flex: 1,
      font: 'var(--type-h2)'
    }
  }, title), action);
}
const TABS = [{
  id: 'feed',
  icon: 'search',
  label: 'Explorer'
}, {
  id: 'saved',
  icon: 'heart',
  label: 'Favoris'
}, {
  id: 'messages',
  icon: 'message-circle',
  label: 'Messages'
}, {
  id: 'profile',
  icon: 'user-round',
  label: 'Profil'
}];
function TabBar({
  active,
  onChange,
  unread
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      height: 'var(--tabbar-h)',
      background: 'var(--surface-card)',
      borderTop: '1px solid var(--border-hairline)',
      paddingBottom: 6
    }
  }, TABS.map(t => {
    const on = t.id === active;
    return /*#__PURE__*/React.createElement("button", {
      key: t.id,
      onClick: () => onChange(t.id),
      style: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        color: on ? 'var(--brand)' : 'var(--text-subtle)',
        position: 'relative',
        minHeight: 'var(--tap-min)'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: t.icon,
      size: 22
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        font: `var(--weight-${on ? 'semibold' : 'medium'}) var(--text-micro)/1 var(--font-ui)`
      }
    }, t.label), t.id === 'messages' && unread > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        top: 6,
        right: 'calc(50% - 18px)',
        minWidth: 16,
        height: 16,
        borderRadius: 'var(--radius-pill)',
        background: 'var(--brand)',
        color: '#fff',
        font: 'var(--weight-bold) 10px/16px var(--font-ui)',
        textAlign: 'center',
        padding: '0 4px'
      }
    }, unread));
  }));
}
function Phone({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 390,
      height: 844,
      margin: '0 auto',
      background: 'var(--bg-page)',
      borderRadius: 44,
      border: '10px solid var(--sable-900)',
      boxShadow: 'var(--shadow-lg)',
      overflow: 'hidden',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column'
    }
  }, children);
}
Object.assign(window, {
  StatusBar,
  TopBar,
  TabBar,
  Phone,
  TABS
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile_app/AppShell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile_app/FeedScreen.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const __DS = window.DariDesignSystem_d1bbe2 || window.__dsMissingBanner || (window.__dsMissingBanner = (() => {
  const d = document.createElement('div');
  d.textContent = 'Design-system bundle not loaded (_ds_bundle.js) — components unavailable.';
  d.style.cssText = 'position:fixed;inset:auto 0 0 0;z-index:999;padding:12px 20px;background:#B33A2B;color:#fff;font:600 13px/1.4 system-ui,sans-serif;text-align:center';
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(d));
  return new Proxy({}, {
    get: () => function Missing() {
      return null;
    }
  });
})());
const {
  Icon,
  Tag,
  ListingCard,
  IconButton,
  Badge,
  Card
} = __DS;
const P = '../../assets/photos/';
const LISTINGS = [{
  id: 1,
  title: 'Chambre lumineuse',
  district: 'Agdal',
  city: 'Rabat',
  price: '3 200',
  flatmates: '2 colocataires',
  rating: '4,8',
  badge: 'Nouveau',
  image: P + 'salon-agdal-4x3.jpg'
}, {
  id: 2,
  title: 'Studio Gauthier',
  district: 'Gauthier',
  city: 'Casablanca',
  price: '5 400',
  rating: '4,6',
  image: P + 'loft-gauthier-4x3.jpg'
}, {
  id: 3,
  title: 'Chambre en médina',
  district: 'Médina',
  city: 'Marrakech',
  price: '2 400',
  flatmates: '3 colocataires',
  rating: '4,9',
  image: P + 'cuisine-medina-4x3.jpg'
}, {
  id: 4,
  title: 'Coliving Malabata',
  district: 'Malabata',
  city: 'Tanger',
  price: '4 100',
  badge: 'Vérifié',
  badgeTone: 'success',
  image: P + 'studio-malabata-4x3.jpg'
}];
const FILTERS = [{
  label: 'Rabat',
  icon: 'map-pin'
}, {
  label: 'Moins de 4 000 MAD',
  icon: 'wallet'
}, {
  label: 'Meublé',
  icon: 'bed-double'
}, {
  label: 'Wi-Fi',
  icon: 'wifi'
}, {
  label: 'Femmes uniquement',
  icon: 'users-round'
}];
function SearchHeader({
  onOpenFilters,
  city,
  count
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-card)',
      borderBottom: '1px solid var(--border-hairline)',
      paddingBottom: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 'var(--space-4) var(--gutter-mobile) 0'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-lockup-terracotta.png",
    alt: "dari",
    style: {
      height: 22,
      width: 'auto',
      display: 'block'
    }
  }), /*#__PURE__*/React.createElement(Icon, {
    name: "bell",
    size: 20,
    color: "var(--text-muted)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-4)',
      padding: 'var(--space-4) var(--gutter-mobile) var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      height: 44,
      padding: '0 14px',
      background: 'var(--bg-inset)',
      border: '1px solid var(--border-hairline)',
      borderRadius: 'var(--radius-pill)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 18,
    color: "var(--text-subtle)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      font: 'var(--type-body)',
      color: 'var(--text-heading)'
    }
  }, city), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--text-muted)'
    }
  }, count, " annonces")), /*#__PURE__*/React.createElement(IconButton, {
    icon: "sliders-horizontal",
    label: "Filtres",
    onClick: onOpenFilters
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-3)',
      padding: '0 var(--gutter-mobile)',
      overflowX: 'auto',
      scrollbarWidth: 'none',
      paddingBottom: 2
    }
  }, FILTERS.map((f, i) => /*#__PURE__*/React.createElement(Tag, {
    key: f.label,
    icon: f.icon,
    selected: i === 0,
    style: {
      flex: '0 0 auto'
    }
  }, f.label))));
}
function FeedScreen({
  onOpen,
  onOpenFilters,
  saved,
  onSave
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement(SearchHeader, {
    city: "Rabat",
    count: 32,
    onOpenFilters: onOpenFilters
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--space-5) var(--gutter-mobile) var(--space-8)',
      display: 'grid',
      gap: 'var(--space-5)'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    padding: "var(--space-4)",
    elevation: "xs",
    style: {
      display: 'flex',
      gap: 'var(--space-4)',
      alignItems: 'center',
      background: 'var(--brand-subtle)',
      borderColor: 'var(--brand-border)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      width: 36,
      height: 36,
      borderRadius: 'var(--radius-pill)',
      background: 'var(--surface-card)',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--brand)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 18
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--type-label)',
      color: 'var(--clay-700)'
    }
  }, "Compl\xE9tez votre profil"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--type-caption)',
      color: 'var(--clay-600)'
    }
  }, "Les profils complets re\xE7oivent 3\xD7 plus de r\xE9ponses.")), /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 18,
    color: "var(--clay-600)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      font: 'var(--type-h2)'
    }
  }, "Chambres \xE0 Rabat"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--text-muted)'
    }
  }, "Trier")), LISTINGS.map(l => /*#__PURE__*/React.createElement(ListingCard, _extends({
    key: l.id
  }, l, {
    saved: !!saved[l.id],
    onSave: () => onSave(l.id),
    onClick: () => onOpen(l)
  })))));
}
function SavedScreen({
  saved,
  onOpen
}) {
  const items = LISTINGS.filter(l => saved[l.id]);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 'var(--space-5) var(--gutter-mobile)'
    }
  }, items.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 'var(--space-4)',
      justifyItems: 'center',
      textAlign: 'center',
      padding: 'var(--space-11) 0',
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "heart",
    size: 32,
    color: "var(--sable-300)"
  }), /*#__PURE__*/React.createElement("h2", {
    style: {
      font: 'var(--type-h3)',
      color: 'var(--text-heading)'
    }
  }, "Aucun favori"), /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--type-body-sm)',
      maxWidth: 240
    }
  }, "Touchez le c\u0153ur sur une annonce pour la retrouver ici.")) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 'var(--space-4)'
    }
  }, items.map(l => /*#__PURE__*/React.createElement(ListingCard, _extends({
    key: l.id,
    layout: "horizontal"
  }, l, {
    onClick: () => onOpen(l)
  })))));
}
Object.assign(window, {
  FeedScreen,
  SavedScreen,
  LISTINGS
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile_app/FeedScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile_app/FiltersSheet.jsx
try { (() => {
const __DS = window.DariDesignSystem_d1bbe2 || window.__dsMissingBanner || (window.__dsMissingBanner = (() => {
  const d = document.createElement('div');
  d.textContent = 'Design-system bundle not loaded (_ds_bundle.js) — components unavailable.';
  d.style.cssText = 'position:fixed;inset:auto 0 0 0;z-index:999;padding:12px 20px;background:#B33A2B;color:#fff;font:600 13px/1.4 system-ui,sans-serif;text-align:center';
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(d));
  return new Proxy({}, {
    get: () => function Missing() {
      return null;
    }
  });
})());
const {
  Dialog,
  Button,
  Tag,
  Select,
  Input,
  Checkbox,
  Tabs
} = __DS;
function FiltersSheet({
  open,
  onClose,
  onApply
}) {
  const [type, setType] = React.useState('Chambre');
  const [charges, setCharges] = React.useState(true);
  const [picked, setPicked] = React.useState(['Wi-Fi']);
  const toggle = t => setPicked(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);
  return /*#__PURE__*/React.createElement(Dialog, {
    open: open,
    sheet: true,
    contained: true,
    title: "Filtres",
    onClose: onClose,
    footer: /*#__PURE__*/React.createElement(Button, {
      fullWidth: true,
      onClick: onApply
    }, "Voir 32 annonces")
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 'var(--space-5)',
      paddingBottom: 'var(--space-2)'
    }
  }, /*#__PURE__*/React.createElement(Tabs, {
    variant: "segmented",
    value: type,
    onChange: setType,
    tabs: ['Chambre', 'Logement entier', 'Coliving']
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Budget min.",
    suffix: "MAD",
    placeholder: "2 000"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Budget max.",
    suffix: "MAD",
    placeholder: "4 500"
  })), /*#__PURE__*/React.createElement(Select, {
    label: "Ville",
    options: ['Rabat', 'Casablanca', 'Marrakech', 'Tanger'],
    value: "Rabat",
    onChange: () => {}
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--type-label)',
      color: 'var(--text-heading)',
      marginBottom: 'var(--space-3)'
    }
  }, "\xC9quipements"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-3)',
      flexWrap: 'wrap'
    }
  }, [['Wi-Fi', 'wifi'], ['Meublé', 'bed-double'], ['Lave-linge', 'washing-machine'], ['Parking', 'car'], ['Terrasse', 'sun']].map(([l, i]) => /*#__PURE__*/React.createElement(Tag, {
    key: l,
    icon: i,
    selected: picked.includes(l),
    onClick: () => toggle(l)
  }, l)))), /*#__PURE__*/React.createElement(Checkbox, {
    label: "Charges incluses",
    description: "Eau, \xE9lectricit\xE9, internet",
    checked: charges,
    onChange: () => setCharges(!charges)
  })));
}
Object.assign(window, {
  FiltersSheet
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile_app/FiltersSheet.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile_app/ListingScreen.jsx
try { (() => {
const __DS = window.DariDesignSystem_d1bbe2 || window.__dsMissingBanner || (window.__dsMissingBanner = (() => {
  const d = document.createElement('div');
  d.textContent = 'Design-system bundle not loaded (_ds_bundle.js) — components unavailable.';
  d.style.cssText = 'position:fixed;inset:auto 0 0 0;z-index:999;padding:12px 20px;background:#B33A2B;color:#fff;font:600 13px/1.4 system-ui,sans-serif;text-align:center';
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(d));
  return new Proxy({}, {
    get: () => function Missing() {
      return null;
    }
  });
})());
const {
  Icon,
  Badge,
  Button,
  IconButton,
  Tag,
  Card,
  Tabs
} = __DS;
const AMENITIES = [{
  icon: 'wifi',
  label: 'Wi-Fi fibre'
}, {
  icon: 'bed-double',
  label: 'Meublé'
}, {
  icon: 'washing-machine',
  label: 'Lave-linge'
}, {
  icon: 'sun',
  label: 'Terrasse'
}, {
  icon: 'car',
  label: 'Parking'
}, {
  icon: 'utensils',
  label: 'Cuisine équipée'
}];
function ListingScreen({
  listing,
  onBack,
  saved,
  onSave,
  onContact
}) {
  const [tab, setTab] = React.useState('logement');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 96
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: 260,
      background: `center/cover no-repeat url(${listing.image || '../../assets/photos/detail-header.jpg'})`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--scrim-image)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 12,
      left: 'var(--gutter-mobile)',
      right: 'var(--gutter-mobile)',
      display: 'flex',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    icon: "chevron-left",
    variant: "glass",
    label: "Retour",
    onClick: onBack
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    icon: "share-2",
    variant: "glass",
    label: "Partager"
  }), /*#__PURE__*/React.createElement(IconButton, {
    icon: "heart",
    variant: "glass",
    active: saved,
    label: "Enregistrer",
    onClick: onSave
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      bottom: 12,
      right: 'var(--gutter-mobile)',
      padding: '4px 10px',
      borderRadius: 'var(--radius-pill)',
      background: 'var(--surface-glass)',
      backdropFilter: 'var(--blur-glass)',
      font: 'var(--type-caption)',
      color: 'var(--sable-900)'
    }
  }, "1 / 8")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--space-6) var(--gutter-mobile)',
      display: 'grid',
      gap: 'var(--space-5)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "success",
    icon: "shield-check"
  }, "Annonce v\xE9rifi\xE9e"), /*#__PURE__*/React.createElement(Badge, {
    tone: "neutral",
    size: "sm"
  }, "Disponible 1er sept.")), /*#__PURE__*/React.createElement("h1", {
    style: {
      font: 'var(--type-h1)'
    }
  }, listing.title, " \u2014 ", listing.district), /*#__PURE__*/React.createElement("p", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      font: 'var(--type-body-sm)',
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "map-pin",
    size: 14
  }), listing.district, ", ", listing.city, " \xB7 12 min du tramway"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-bold) 26px/1.2 var(--font-ui)',
      color: 'var(--text-price)'
    }
  }, listing.price, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--text-muted)',
      marginLeft: 4
    }
  }, "MAD/mois")), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--text-muted)'
    }
  }, "charges comprises"))), /*#__PURE__*/React.createElement(Tabs, {
    value: tab,
    onChange: setTab,
    tabs: [{
      value: 'logement',
      label: 'Le logement'
    }, {
      value: 'coloc',
      label: 'Colocataires'
    }, {
      value: 'regles',
      label: 'Règles'
    }]
  }), tab === 'logement' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 'var(--space-5)'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--type-body)'
    }
  }, "Chambre de 14 m\xB2 dans un appartement de trois chambres, au calme, \xE0 deux pas des caf\xE9s de l'avenue. Lumi\xE8re du matin, balcon partag\xE9, cuisine refaite en 2024."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 'var(--space-4)'
    }
  }, AMENITIES.map(a => /*#__PURE__*/React.createElement("span", {
    key: a.label,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      font: 'var(--type-body-sm)',
      color: 'var(--text-body)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: a.icon,
    size: 18,
    color: "var(--text-muted)"
  }), a.label)))), tab === 'coloc' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 'var(--space-4)'
    }
  }, [['Salma', '28 ans · architecte'], ['Youssef', '31 ans · ingénieur']].map(([n, m]) => /*#__PURE__*/React.createElement(Card, {
    key: n,
    padding: "var(--space-4)",
    style: {
      display: 'flex',
      gap: 'var(--space-4)',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 'var(--radius-avatar)',
      background: 'var(--sand-100)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: 'var(--weight-bold) 16px/1 var(--font-ui)',
      color: 'var(--sand-700)'
    }
  }, n[0]), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--type-label)',
      color: 'var(--text-heading)'
    }
  }, n), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--type-caption)',
      color: 'var(--text-muted)'
    }
  }, m)), /*#__PURE__*/React.createElement(Badge, {
    tone: "success",
    size: "sm",
    icon: "shield-check"
  }, "V\xE9rifi\xE9")))), tab === 'regles' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 'var(--space-3)'
    }
  }, ['Non-fumeur à l\'intérieur', 'Animaux acceptés', 'Bail minimum 6 mois', 'Caution : 1 mois'].map(r => /*#__PURE__*/React.createElement("span", {
    key: r,
    style: {
      display: 'flex',
      gap: 'var(--space-3)',
      alignItems: 'center',
      font: 'var(--type-body-sm)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 16,
    color: "var(--success)"
  }), r))), /*#__PURE__*/React.createElement(Card, {
    padding: "var(--space-5)",
    style: {
      display: 'grid',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-4)',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 48,
      height: 48,
      borderRadius: 'var(--radius-avatar)',
      background: 'var(--clay-100)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: 'var(--weight-bold) 17px/1 var(--font-ui)',
      color: 'var(--clay-700)'
    }
  }, "N"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--type-label)',
      color: 'var(--text-heading)'
    }
  }, "Nadia \xB7 propri\xE9taire"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--type-caption)',
      color: 'var(--text-muted)'
    }
  }, "R\xE9pond en moyenne en 2 h")), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      font: 'var(--type-caption)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "star",
    size: 14,
    color: "var(--sand-400)"
  }), "4,8")))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      gap: 'var(--space-4)',
      alignItems: 'center',
      padding: 'var(--space-4) var(--gutter-mobile)',
      background: 'var(--surface-glass)',
      backdropFilter: 'var(--blur-glass)',
      borderTop: '1px solid var(--border-hairline)'
    }
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--weight-bold) 17px/1.2 var(--font-ui)',
      color: 'var(--text-price)'
    }
  }, listing.price, " MAD"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--type-caption)',
      color: 'var(--text-muted)'
    }
  }, "par mois")), /*#__PURE__*/React.createElement(Button, {
    iconLeft: "message-circle",
    style: {
      marginLeft: 'auto'
    },
    onClick: onContact
  }, "Contacter")));
}
Object.assign(window, {
  ListingScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile_app/ListingScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile_app/MessagesScreen.jsx
try { (() => {
const __DS = window.DariDesignSystem_d1bbe2 || window.__dsMissingBanner || (window.__dsMissingBanner = (() => {
  const d = document.createElement('div');
  d.textContent = 'Design-system bundle not loaded (_ds_bundle.js) — components unavailable.';
  d.style.cssText = 'position:fixed;inset:auto 0 0 0;z-index:999;padding:12px 20px;background:#B33A2B;color:#fff;font:600 13px/1.4 system-ui,sans-serif;text-align:center';
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(d));
  return new Proxy({}, {
    get: () => function Missing() {
      return null;
    }
  });
})());
const {
  Icon,
  Badge,
  Button,
  Input,
  Card
} = __DS;
const THREADS = [{
  id: 1,
  name: 'Nadia',
  last: 'Bonjour Salma, la chambre est libre à partir du 1er septembre.',
  time: '09:12',
  unread: 2,
  initial: 'N'
}, {
  id: 2,
  name: 'Youssef',
  last: 'On peut faire une visite jeudi soir si ça vous va.',
  time: 'Hier',
  unread: 0,
  initial: 'Y'
}, {
  id: 3,
  name: 'Coliving Malabata',
  last: 'Merci pour votre message, voici les disponibilités…',
  time: 'Lun',
  unread: 0,
  initial: 'C'
}];
function MessagesScreen({
  onOpenThread
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto'
    }
  }, THREADS.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.id,
    onClick: () => onOpenThread(t),
    style: {
      display: 'flex',
      gap: 'var(--space-4)',
      width: '100%',
      alignItems: 'center',
      padding: 'var(--space-4) var(--gutter-mobile)',
      border: 'none',
      borderBottom: '1px solid var(--border-hairline)',
      background: 'var(--surface-card)',
      textAlign: 'left',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 48,
      height: 48,
      flex: '0 0 auto',
      borderRadius: 'var(--radius-avatar)',
      background: 'var(--sand-100)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: 'var(--weight-bold) 17px/1 var(--font-ui)',
      color: 'var(--sand-700)'
    }
  }, t.initial), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-label)',
      color: 'var(--text-heading)'
    }
  }, t.name), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--text-subtle)'
    }
  }, t.time)), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      marginTop: 2,
      font: `var(--weight-${t.unread ? 'medium' : 'regular'}) var(--text-body-sm)/var(--lh-snug) var(--font-ui)`,
      color: t.unread ? 'var(--text-body)' : 'var(--text-muted)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, t.last)), t.unread > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      flex: '0 0 auto',
      minWidth: 20,
      height: 20,
      borderRadius: 'var(--radius-pill)',
      background: 'var(--brand)',
      color: '#fff',
      font: 'var(--weight-bold) 11px/20px var(--font-ui)',
      textAlign: 'center'
    }
  }, t.unread))));
}
function ThreadScreen({
  thread,
  messages,
  onSend
}) {
  const [draft, setDraft] = React.useState('');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 'var(--space-5) var(--gutter-mobile)',
      display: 'grid',
      gap: 'var(--space-4)',
      alignContent: 'start'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    padding: "var(--space-4)",
    elevation: "xs",
    style: {
      display: 'flex',
      gap: 'var(--space-4)',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 'var(--radius-card-inner)',
      background: 'center/cover no-repeat url(../../assets/photos/thread-thumb.jpg)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--type-label)',
      color: 'var(--text-heading)'
    }
  }, "Chambre lumineuse \u2014 Agdal"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--type-caption)',
      color: 'var(--text-muted)'
    }
  }, "3 200 MAD/mois \xB7 Rabat")), /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 18,
    color: "var(--text-subtle)"
  })), messages.map((m, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      maxWidth: '78%',
      alignSelf: m.me ? 'flex-end' : 'flex-start',
      padding: '10px 14px',
      borderRadius: m.me ? 'var(--radius-md) var(--radius-md) var(--radius-xs) var(--radius-md)' : 'var(--radius-md) var(--radius-md) var(--radius-md) var(--radius-xs)',
      background: m.me ? 'var(--brand)' : 'var(--surface-card)',
      color: m.me ? 'var(--text-on-brand)' : 'var(--text-body)',
      border: m.me ? 'none' : '1px solid var(--border-hairline)',
      boxShadow: 'var(--shadow-xs)',
      font: 'var(--type-body)',
      animation: 'dari-fade-up var(--dur-med) var(--ease-out)'
    }
  }, m.text))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-3)',
      alignItems: 'center',
      padding: 'var(--space-4) var(--gutter-mobile)',
      background: 'var(--surface-card)',
      borderTop: '1px solid var(--border-hairline)'
    }
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "\xC9crire un message\u2026",
    value: draft,
    onChange: e => setDraft(e.target.value),
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(Button, {
    size: "md",
    iconLeft: "send",
    onClick: () => {
      if (draft.trim()) {
        onSend(draft);
        setDraft('');
      }
    },
    style: {
      padding: '0 16px'
    }
  }, "Envoyer")));
}
Object.assign(window, {
  MessagesScreen,
  ThreadScreen,
  THREADS
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile_app/MessagesScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile_app/ProfileScreen.jsx
try { (() => {
const __DS = window.DariDesignSystem_d1bbe2 || window.__dsMissingBanner || (window.__dsMissingBanner = (() => {
  const d = document.createElement('div');
  d.textContent = 'Design-system bundle not loaded (_ds_bundle.js) — components unavailable.';
  d.style.cssText = 'position:fixed;inset:auto 0 0 0;z-index:999;padding:12px 20px;background:#B33A2B;color:#fff;font:600 13px/1.4 system-ui,sans-serif;text-align:center';
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(d));
  return new Proxy({}, {
    get: () => function Missing() {
      return null;
    }
  });
})());
const {
  Icon,
  Badge,
  Button,
  Card,
  Switch,
  Tabs
} = __DS;
function ProfileScreen() {
  const [alerts, setAlerts] = React.useState(true);
  const [visible, setVisible] = React.useState(true);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 'var(--space-6) var(--gutter-mobile) var(--space-8)',
      display: 'grid',
      gap: 'var(--space-6)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-5)',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 72,
      height: 72,
      borderRadius: 'var(--radius-avatar)',
      background: 'var(--clay-100)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: 'var(--weight-extra) 26px/1 var(--font-display)',
      color: 'var(--clay-700)'
    }
  }, "S"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--type-h2)',
      color: 'var(--text-heading)'
    }
  }, "Salma B."), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--type-caption)',
      color: 'var(--text-muted)',
      marginTop: 2
    }
  }, "Rabat \xB7 cherche une chambre"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "success",
    size: "sm",
    icon: "shield-check"
  }, "Identit\xE9 v\xE9rifi\xE9e")))), /*#__PURE__*/React.createElement(Card, {
    padding: "var(--space-5)",
    style: {
      display: 'grid',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      font: 'var(--type-h3)'
    }
  }, "Profil de recherche"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm"
  }, "Modifier")), [['Budget', '3 000 – 4 000 MAD'], ['Villes', 'Rabat, Salé'], ['Emménagement', '1er septembre'], ['Durée', '12 mois']].map(([k, v]) => /*#__PURE__*/React.createElement("span", {
    key: k,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 12,
      font: 'var(--type-body-sm)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-muted)'
    }
  }, k), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-heading)',
      fontWeight: 'var(--weight-semibold)'
    }
  }, v)))), /*#__PURE__*/React.createElement(Card, {
    padding: "var(--space-5)",
    style: {
      display: 'grid',
      gap: 'var(--space-2)'
    }
  }, /*#__PURE__*/React.createElement(Switch, {
    label: "Alertes nouvelles annonces",
    description: "Une notification par jour maximum",
    checked: alerts,
    onChange: () => setAlerts(!alerts)
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      height: 1,
      background: 'var(--border-hairline)',
      margin: 'var(--space-2) 0'
    }
  }), /*#__PURE__*/React.createElement(Switch, {
    label: "Profil visible par les propri\xE9taires",
    checked: visible,
    onChange: () => setVisible(!visible)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 'var(--space-1)'
    }
  }, [['file-text', 'Mes documents'], ['credit-card', 'Paiements'], ['circle-help', 'Aide et sécurité'], ['log-out', 'Se déconnecter']].map(([i, l]) => /*#__PURE__*/React.createElement("button", {
    key: l,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-4)',
      minHeight: 'var(--tap-min)',
      padding: '0 var(--space-2)',
      border: 'none',
      background: 'transparent',
      cursor: 'pointer',
      font: 'var(--type-body)',
      color: l === 'Se déconnecter' ? 'var(--danger)' : 'var(--text-body)',
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: i,
    size: 20,
    color: l === 'Se déconnecter' ? 'var(--danger)' : 'var(--text-muted)'
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, l), /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 18,
    color: "var(--text-subtle)"
  })))));
}
Object.assign(window, {
  ProfileScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile_app/ProfileScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/HomePage.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const __DS = window.DariDesignSystem_d1bbe2 || window.__dsMissingBanner || (window.__dsMissingBanner = (() => {
  const d = document.createElement('div');
  d.textContent = 'Design-system bundle not loaded (_ds_bundle.js) — components unavailable.';
  d.style.cssText = 'position:fixed;inset:auto 0 0 0;z-index:999;padding:12px 20px;background:#B33A2B;color:#fff;font:600 13px/1.4 system-ui,sans-serif;text-align:center';
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(d));
  return new Proxy({}, {
    get: () => function Missing() {
      return null;
    }
  });
})());
const {
  Icon,
  Button,
  Card,
  Badge,
  Tag,
  ListingCard,
  Select,
  Input,
  Tabs
} = __DS;
const CITIES = [['Rabat', '412 chambres', 'tile-rabat.jpg'], ['Casablanca', '938 chambres', 'tile-casablanca.jpg'], ['Marrakech', '307 chambres', 'tile-marrakech.jpg'], ['Tanger', '186 chambres', 'tile-tanger.jpg']];
const P = '../../assets/photos/';
const FEATURED = [{
  id: 1,
  title: 'Chambre lumineuse',
  district: 'Agdal',
  city: 'Rabat',
  price: '3 200',
  flatmates: '2 colocataires',
  rating: '4,8',
  badge: 'Nouveau',
  image: P + 'salon-agdal-4x3.jpg'
}, {
  id: 2,
  title: 'Studio Gauthier',
  district: 'Gauthier',
  city: 'Casablanca',
  price: '5 400',
  rating: '4,6',
  image: P + 'loft-gauthier-4x3.jpg'
}, {
  id: 3,
  title: 'Chambre en médina',
  district: 'Médina',
  city: 'Marrakech',
  price: '2 400',
  flatmates: '3 colocataires',
  rating: '4,9',
  image: P + 'cuisine-medina-4x3.jpg'
}, {
  id: 4,
  title: 'Coliving Malabata',
  district: 'Malabata',
  city: 'Tanger',
  price: '4 100',
  badge: 'Vérifié',
  badgeTone: 'success',
  image: P + 'studio-malabata-4x3.jpg'
}];
const STEPS = [['search', 'Cherchez', 'Filtrez par quartier, budget et style de vie.'], ['shield-check', 'Vérifiez', 'Annonces et profils contrôlés avant publication.'], ['message-circle', 'Discutez', 'Échangez avec le propriétaire et les colocataires.'], ['key-round', 'Emménagez', 'Bail signé en ligne, caution protégée.']];
function SearchBar({
  onSearch
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-3)',
      alignItems: 'flex-end',
      background: 'var(--surface-card)',
      border: '1px solid var(--border-hairline)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: 'var(--shadow-lg)',
      padding: 'var(--space-5)'
    }
  }, /*#__PURE__*/React.createElement(Select, {
    label: "Ville",
    options: ['Rabat', 'Casablanca', 'Marrakech', 'Tanger'],
    value: "Rabat",
    onChange: () => {},
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Budget max.",
    suffix: "MAD",
    placeholder: "4 000",
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(Select, {
    label: "Type",
    options: ['Chambre', 'Logement entier', 'Coliving'],
    value: "Chambre",
    onChange: () => {},
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    iconLeft: "search",
    onClick: onSearch
  }, "Rechercher"));
}
function HomePage({
  onSearch,
  onOpenListing
}) {
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement("section", {
    style: {
      position: 'relative',
      padding: 'var(--space-11) var(--gutter-desktop) var(--space-10)',
      background: 'linear-gradient(180deg,var(--clay-50) 0%,var(--bg-page) 78%)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--container-max)',
      margin: '0 auto',
      display: 'grid',
      gridTemplateColumns: '1.05fr .95fr',
      gap: 'var(--space-9)',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 'var(--space-5)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      width: 'fit-content'
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "brand",
    icon: "shield-check"
  }, "Annonces v\xE9rifi\xE9es une par une")), /*#__PURE__*/React.createElement("h1", {
    style: {
      font: 'var(--weight-extra) 52px/1.08 var(--font-display)',
      letterSpacing: 'var(--ls-display)'
    }
  }, "Une chambre, des colocataires, une vraie adresse."), /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--type-body-lg)',
      color: 'var(--text-muted)',
      maxWidth: 520
    }
  }, "Trouvez une colocation \xE0 Rabat, Casablanca, Marrakech ou Tanger \u2014 avec des profils v\xE9rifi\xE9s et des loyers annonc\xE9s charges comprises."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-4)',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    onClick: onSearch
  }, "Voir les chambres"), /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    variant: "secondary",
    iconLeft: "plus"
  }, "Publier une annonce"))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 380,
      borderRadius: 'var(--radius-2xl)',
      boxShadow: 'var(--shadow-md)',
      background: `center/cover no-repeat url(${P}hero.jpg)`
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--container-max)',
      margin: 'var(--space-9) auto 0'
    }
  }, /*#__PURE__*/React.createElement(SearchBar, {
    onSearch: onSearch
  }))), /*#__PURE__*/React.createElement("section", {
    style: {
      padding: 'var(--space-10) var(--gutter-desktop)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--container-max)',
      margin: '0 auto',
      display: 'grid',
      gap: 'var(--space-6)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      font: 'var(--weight-bold) 32px/1.2 var(--font-display)'
    }
  }, "Chambres en vedette"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onSearch();
    }
  }, "Voir les 1 843 annonces \u2192")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 'var(--space-5)'
    }
  }, FEATURED.map(l => /*#__PURE__*/React.createElement(ListingCard, _extends({
    key: l.id
  }, l, {
    onClick: onOpenListing
  })))))), /*#__PURE__*/React.createElement("section", {
    style: {
      padding: 'var(--space-10) var(--gutter-desktop)',
      background: 'var(--bg-page-alt)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--container-max)',
      margin: '0 auto',
      display: 'grid',
      gap: 'var(--space-6)'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      font: 'var(--weight-bold) 32px/1.2 var(--font-display)'
    }
  }, "Comment \xE7a marche"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 'var(--space-5)'
    }
  }, STEPS.map(([i, t, d], n) => /*#__PURE__*/React.createElement(Card, {
    key: t,
    padding: "var(--card-pad-lg)",
    style: {
      display: 'grid',
      gap: 'var(--space-3)',
      alignContent: 'start'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      width: 44,
      height: 44,
      borderRadius: 'var(--radius-pill)',
      background: 'var(--brand-subtle)',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--brand)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: i,
    size: 20
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-eyebrow)',
      letterSpacing: 'var(--ls-caps)',
      textTransform: 'uppercase',
      color: 'var(--text-subtle)'
    }
  }, "\xC9tape ", n + 1), /*#__PURE__*/React.createElement("h3", {
    style: {
      font: 'var(--type-h3)'
    }
  }, t), /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--type-body-sm)',
      color: 'var(--text-muted)'
    }
  }, d)))))), /*#__PURE__*/React.createElement("section", {
    style: {
      padding: 'var(--space-10) var(--gutter-desktop)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--container-max)',
      margin: '0 auto',
      display: 'grid',
      gap: 'var(--space-6)'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      font: 'var(--weight-bold) 32px/1.2 var(--font-display)'
    }
  }, "Explorer par ville"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 'var(--space-5)'
    }
  }, CITIES.map(([c, n, img]) => /*#__PURE__*/React.createElement("div", {
    key: c,
    style: {
      position: 'relative',
      height: 200,
      borderRadius: 'var(--radius-card)',
      overflow: 'hidden',
      background: `center/cover no-repeat url(${P}${img})`,
      cursor: 'pointer'
    },
    onClick: onSearch
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--scrim-image)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      bottom: 14,
      left: 16,
      color: '#fff'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--weight-bold) 20px/1.2 var(--font-display)'
    }
  }, c), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--type-caption)',
      opacity: .88
    }
  }, n))))))), /*#__PURE__*/React.createElement("section", {
    style: {
      padding: '0 var(--gutter-desktop) var(--space-11)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--container-max)',
      margin: '0 auto',
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-8)',
      background: 'var(--clay-500)',
      borderRadius: 'var(--radius-2xl)',
      padding: 'var(--space-9) var(--space-10)',
      color: '#fff'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'grid',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      font: 'var(--weight-extra) 34px/1.15 var(--font-display)',
      color: '#fff',
      letterSpacing: 'var(--ls-display)'
    }
  }, "Vous avez une chambre libre ?"), /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--type-body-lg)',
      color: 'var(--clay-50)',
      maxWidth: 520
    }
  }, "Publiez gratuitement, choisissez vos colocataires, encaissez le loyer en ligne.")), /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    variant: "secondary"
  }, "Publier une annonce"))));
}
Object.assign(window, {
  HomePage,
  FEATURED
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/HomePage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/SearchResultsPage.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const __DS = window.DariDesignSystem_d1bbe2 || window.__dsMissingBanner || (window.__dsMissingBanner = (() => {
  const d = document.createElement('div');
  d.textContent = 'Design-system bundle not loaded (_ds_bundle.js) — components unavailable.';
  d.style.cssText = 'position:fixed;inset:auto 0 0 0;z-index:999;padding:12px 20px;background:#B33A2B;color:#fff;font:600 13px/1.4 system-ui,sans-serif;text-align:center';
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(d));
  return new Proxy({}, {
    get: () => function Missing() {
      return null;
    }
  });
})());
const {
  Icon,
  Button,
  Card,
  Tag,
  Tabs,
  ListingCard,
  Select,
  Input,
  Checkbox,
  Switch,
  Badge
} = __DS;
function FilterRail() {
  const [picked, setPicked] = React.useState(['Wi-Fi']);
  const [charges, setCharges] = React.useState(true);
  const [feminine, setFeminine] = React.useState(false);
  const [verified, setVerified] = React.useState(true);
  const toggle = t => setPicked(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);
  return /*#__PURE__*/React.createElement("aside", {
    style: {
      position: 'sticky',
      top: 'calc(var(--nav-h-desktop) + 24px)',
      display: 'grid',
      gap: 'var(--space-6)',
      alignContent: 'start'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    padding: "var(--card-pad-lg)",
    style: {
      display: 'grid',
      gap: 'var(--space-5)'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      font: 'var(--type-h3)'
    }
  }, "Filtres"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Min.",
    suffix: "MAD",
    placeholder: "2 000"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Max.",
    suffix: "MAD",
    placeholder: "4 500"
  })), /*#__PURE__*/React.createElement(Select, {
    label: "Quartier",
    options: ['Agdal', 'Hassan', 'Hay Riad', 'Océan'],
    value: "Agdal",
    onChange: () => {}
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--type-label)',
      color: 'var(--text-heading)',
      marginBottom: 'var(--space-3)'
    }
  }, "\xC9quipements"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-3)',
      flexWrap: 'wrap'
    }
  }, [['Wi-Fi', 'wifi'], ['Meublé', 'bed-double'], ['Lave-linge', 'washing-machine'], ['Parking', 'car']].map(([l, i]) => /*#__PURE__*/React.createElement(Tag, {
    key: l,
    icon: i,
    selected: picked.includes(l),
    onClick: () => toggle(l)
  }, l)))), /*#__PURE__*/React.createElement("span", {
    style: {
      height: 1,
      background: 'var(--border-hairline)'
    }
  }), /*#__PURE__*/React.createElement(Checkbox, {
    label: "Charges incluses",
    checked: charges,
    onChange: () => setCharges(!charges)
  }), /*#__PURE__*/React.createElement(Checkbox, {
    label: "Colocation f\xE9minine",
    checked: feminine,
    onChange: () => setFeminine(!feminine)
  }), /*#__PURE__*/React.createElement(Switch, {
    label: "Annonces v\xE9rifi\xE9es uniquement",
    checked: verified,
    onChange: () => setVerified(!verified)
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    fullWidth: true
  }, "R\xE9initialiser")));
}
function SearchResultsPage({
  onBack,
  onOpenListing
}) {
  const [sort, setSort] = React.useState('Pertinence');
  const items = [...window.FEATURED, ...window.FEATURED.map(l => ({
    ...l,
    id: l.id + 10
  }))];
  return /*#__PURE__*/React.createElement("main", {
    style: {
      padding: 'var(--space-7) var(--gutter-desktop) var(--space-10)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--container-max)',
      margin: '0 auto',
      display: 'grid',
      gap: 'var(--space-6)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    iconLeft: "chevron-left",
    onClick: onBack
  }, "Accueil"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--text-subtle)'
    }
  }, "Rabat \xB7 Chambre \xB7 moins de 4 000 MAD")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 'var(--space-5)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    style: {
      font: 'var(--weight-bold) 32px/1.2 var(--font-display)'
    }
  }, "412 chambres \xE0 Rabat"), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 6,
      font: 'var(--type-body-sm)',
      color: 'var(--text-muted)'
    }
  }, "Mises \xE0 jour aujourd'hui \xB7 loyers charges comprises")), /*#__PURE__*/React.createElement(Tabs, {
    variant: "segmented",
    value: sort,
    onChange: setSort,
    tabs: ['Pertinence', 'Prix', 'Nouveautés']
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '300px 1fr',
      gap: 'var(--space-7)',
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement(FilterRail, null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 'var(--space-5)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 'var(--space-5)'
    }
  }, items.map(l => /*#__PURE__*/React.createElement(ListingCard, _extends({
    key: l.id
  }, l, {
    onClick: onOpenListing
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      paddingTop: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary"
  }, "Afficher plus d'annonces"))))));
}
Object.assign(window, {
  SearchResultsPage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/SearchResultsPage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/SiteChrome.jsx
try { (() => {
const __DS = window.DariDesignSystem_d1bbe2 || window.__dsMissingBanner || (window.__dsMissingBanner = (() => {
  const d = document.createElement('div');
  d.textContent = 'Design-system bundle not loaded (_ds_bundle.js) — components unavailable.';
  d.style.cssText = 'position:fixed;inset:auto 0 0 0;z-index:999;padding:12px 20px;background:#B33A2B;color:#fff;font:600 13px/1.4 system-ui,sans-serif;text-align:center';
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(d));
  return new Proxy({}, {
    get: () => function Missing() {
      return null;
    }
  });
})());
const {
  Icon,
  Button
} = __DS;
function Wordmark({
  variant = 'terracotta',
  height = 28
}) {
  return /*#__PURE__*/React.createElement("img", {
    src: `../../assets/logo-lockup-${variant}.png`,
    alt: "dari",
    style: {
      height,
      width: 'auto',
      display: 'block'
    }
  });
}
function SiteHeader({
  onSearch
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 10,
      height: 'var(--nav-h-desktop)',
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-8)',
      padding: '0 var(--gutter-desktop)',
      background: 'var(--surface-glass)',
      backdropFilter: 'var(--blur-glass)',
      borderBottom: '1px solid var(--border-hairline)'
    }
  }, /*#__PURE__*/React.createElement(Wordmark, null), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      gap: 'var(--space-7)',
      alignItems: 'center',
      flex: 1
    }
  }, ['Chambres', 'Colocataires', 'Villes', 'Comment ça marche'].map(l => /*#__PURE__*/React.createElement("a", {
    key: l,
    href: "#",
    style: {
      font: 'var(--weight-medium) var(--text-body-md)/1 var(--font-ui)',
      color: 'var(--text-body)',
      textDecoration: 'none',
      whiteSpace: 'nowrap'
    }
  }, l))), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm"
  }, "Se connecter"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    iconLeft: "plus",
    onClick: onSearch
  }, "Publier une annonce"));
}
function SiteFooter() {
  const cols = [['Louer', ['Chambres à Rabat', 'Chambres à Casablanca', 'Colocation à Marrakech', 'Coliving à Tanger']], ['Propriétaires', ['Publier une annonce', 'Tarifs', 'Vérification', 'Guide du bail']], ['Dari', ['À propos', 'Sécurité', 'Aide', 'Presse']]];
  return /*#__PURE__*/React.createElement("footer", {
    style: {
      background: 'var(--surface-inverse)',
      color: 'var(--text-on-inverse)',
      padding: 'var(--space-10) var(--gutter-desktop) var(--space-8)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--container-max)',
      margin: '0 auto',
      display: 'grid',
      gridTemplateColumns: '1.4fr repeat(3,1fr)',
      gap: 'var(--space-8)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 'var(--space-4)',
      alignContent: 'start'
    }
  }, /*#__PURE__*/React.createElement(Wordmark, {
    variant: "cream",
    height: 30
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--type-body-sm)',
      color: 'var(--sable-300)',
      maxWidth: 260
    }
  }, "Des chambres v\xE9rifi\xE9es et des colocataires de confiance \xE0 Rabat, Casablanca, Marrakech et Tanger.")), cols.map(([h, links]) => /*#__PURE__*/React.createElement("div", {
    key: h,
    style: {
      display: 'grid',
      gap: 'var(--space-3)',
      alignContent: 'start'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-eyebrow)',
      letterSpacing: 'var(--ls-caps)',
      textTransform: 'uppercase',
      color: 'var(--sand-300)'
    }
  }, h), links.map(l => /*#__PURE__*/React.createElement("a", {
    key: l,
    href: "#",
    style: {
      font: 'var(--weight-regular) var(--text-body-sm)/1.5 var(--font-ui)',
      color: 'var(--sable-200)',
      textDecoration: 'none'
    }
  }, l))))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--container-max)',
      margin: 'var(--space-8) auto 0',
      paddingTop: 'var(--space-5)',
      borderTop: '1px solid rgba(255,255,255,.12)',
      display: 'flex',
      justifyContent: 'space-between',
      font: 'var(--type-caption)',
      color: 'var(--sable-400)'
    }
  }, /*#__PURE__*/React.createElement("span", null, "\xA9 2026 Dari \xB7 Casablanca, Maroc"), /*#__PURE__*/React.createElement("span", null, "Conditions \xB7 Confidentialit\xE9")));
}
Object.assign(window, {
  SiteHeader,
  SiteFooter,
  Wordmark
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/SiteChrome.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Radio = __ds_scope.Radio;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.ListingCard = __ds_scope.ListingCard;

__ds_ns.Tabs = __ds_scope.Tabs;

})();
