import React from 'react';
import { Icon } from './Icon.jsx';

const S={sm:36,md:44,lg:52};

/** Circular icon-only control — favourites, close, back, share. */
export function IconButton({icon='heart',size='md',variant='secondary',active=false,label,onClick,style,...rest}){
  const d=S[size]||44;const [h,setH]=React.useState(false),[p,setP]=React.useState(false);
  const looks={
    secondary:{bg:'var(--surface-card)',fg:'var(--text-heading)',bd:'var(--border-hairline)',sh:'var(--shadow-sm)'},
    glass:{bg:'var(--surface-glass)',fg:'var(--sable-900)',bd:'rgba(255,255,255,.6)',sh:'var(--shadow-sm)'},
    ghost:{bg:'transparent',fg:'var(--text-body)',bd:'transparent',sh:'none'},
    brand:{bg:'var(--brand)',fg:'#fff',bd:'transparent',sh:'var(--shadow-brand)'}
  }[variant]||{};
  return (
    <button type="button" aria-label={label||icon} aria-pressed={active} onClick={onClick}
      onMouseEnter={()=>setH(true)} onMouseLeave={()=>{setH(false);setP(false)}}
      onMouseDown={()=>setP(true)} onMouseUp={()=>setP(false)}
      style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:d,height:d,
        borderRadius:'var(--radius-pill)',border:`1px solid ${looks.bd}`,background:looks.bg,
        color:active?'var(--brand)':looks.fg,boxShadow:looks.sh,cursor:'pointer',
        backdropFilter:variant==='glass'?'var(--blur-glass)':undefined,
        transform:p?'scale(var(--press-scale))':h?'scale(1.03)':'none',
        transition:'var(--transition-control)',...style}} {...rest}>
      <Icon name={icon} size={size==='sm'?16:size==='lg'?24:20} style={active?{filter:'none'}:undefined}/>
    </button>
  );
}
