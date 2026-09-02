import React from 'react';
import { Icon } from './Icon.jsx';

const SIZES={sm:{h:'var(--control-h-sm)',px:14,fs:'var(--text-body-sm)',gap:6,icon:16},md:{h:'var(--control-h-md)',px:20,fs:'var(--text-body-md)',gap:8,icon:18},lg:{h:'var(--control-h-lg)',px:24,fs:'var(--text-body-lg)',gap:10,icon:20}};

const VARIANTS={
  primary:{bg:'var(--brand)',fg:'var(--text-on-brand)',bd:'transparent',hover:'var(--brand-hover)',press:'var(--brand-press)',shadow:'var(--shadow-brand)'},
  secondary:{bg:'var(--surface-card)',fg:'var(--text-heading)',bd:'var(--border-default)',hover:'var(--sable-50)',press:'var(--sable-100)',shadow:'var(--shadow-xs)'},
  subtle:{bg:'var(--brand-subtle)',fg:'var(--clay-700)',bd:'transparent',hover:'var(--brand-subtle-hover)',press:'var(--clay-200)',shadow:'none'},
  ghost:{bg:'transparent',fg:'var(--text-body)',bd:'transparent',hover:'var(--sable-100)',press:'var(--sable-200)',shadow:'none'},
  danger:{bg:'var(--danger)',fg:'#fff',bd:'transparent',hover:'var(--rose-700)',press:'var(--rose-700)',shadow:'none'}
};

/** Primary interactive control. Pill-shaped, warm-shadowed, 44px tall by default. */
export function Button({children,variant='primary',size='md',iconLeft,iconRight,fullWidth=false,loading=false,disabled=false,onClick,style,...rest}){
  const s=SIZES[size]||SIZES.md, v=VARIANTS[variant]||VARIANTS.primary;
  const [h,setH]=React.useState(false),[p,setP]=React.useState(false);
  const off=disabled||loading;
  return (
    <button type="button" disabled={off} onClick={onClick}
      onMouseEnter={()=>setH(true)} onMouseLeave={()=>{setH(false);setP(false)}}
      onMouseDown={()=>setP(true)} onMouseUp={()=>setP(false)}
      style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:s.gap,
        height:s.h,padding:`0 ${s.px}px`,width:fullWidth?'100%':'auto',
        font:`var(--weight-semibold) ${s.fs}/1 var(--font-ui)`,letterSpacing:'0em',
        color:v.fg,background:off?'var(--sable-200)':(p?v.press:h?v.hover:v.bg),
        border:`1px solid ${off?'transparent':v.bd}`,borderRadius:'var(--radius-pill)',
        boxShadow:off?'none':(h&&variant==='primary'?'var(--shadow-brand)':v.shadow),
        transform:p&&!off?'scale(var(--press-scale))':'none',
        cursor:off?'not-allowed':'pointer',transition:'var(--transition-control)',
        opacity:off?.75:1,...style}} {...rest}>
      {loading&&<Icon name="loader-circle" size={s.icon} style={{animation:'dari-spin 900ms linear infinite'}}/>}
      {!loading&&iconLeft&&<Icon name={iconLeft} size={s.icon}/>}
      {children}
      {!loading&&iconRight&&<Icon name={iconRight} size={s.icon}/>}
    </button>
  );
}
