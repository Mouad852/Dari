import React from 'react';

/** Hover/focus hint on desktop. On mobile, prefer helper text. */
export function Tooltip({label,children,placement='top',style,...rest}){
  const [on,setOn]=React.useState(false);
  const pos=placement==='bottom'?{top:'calc(100% + 8px)'}:{bottom:'calc(100% + 8px)'};
  return <span style={{position:'relative',display:'inline-flex',...style}}
    onMouseEnter={()=>setOn(true)} onMouseLeave={()=>setOn(false)}
    onFocus={()=>setOn(true)} onBlur={()=>setOn(false)} {...rest}>
    {children}
    {on&&<span role="tooltip" style={{position:'absolute',left:'50%',transform:'translateX(-50%)',...pos,
      whiteSpace:'nowrap',padding:'6px 10px',background:'var(--surface-inverse)',color:'var(--text-on-inverse)',
      borderRadius:'var(--radius-xs)',font:'var(--type-caption)',boxShadow:'var(--shadow-md)',
      animation:'dari-pop-in var(--dur-fast) var(--ease-out)',zIndex:20}}>{label}</span>}
  </span>;
}
