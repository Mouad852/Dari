import React from 'react';
import { Icon } from './Icon.jsx';

/** Selectable filter chip / amenity tag. */
export function Tag({children,icon,selected=false,removable=false,onClick,onRemove,style,...rest}){
  const [h,setH]=React.useState(false);
  return (
    <button type="button" onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{display:'inline-flex',alignItems:'center',gap:6,height:36,padding:'0 14px',
        background:selected?'var(--sable-900)':(h?'var(--sable-100)':'var(--surface-card)'),
        color:selected?'var(--text-on-inverse)':'var(--text-body)',
        border:`1px solid ${selected?'var(--sable-900)':'var(--border-hairline)'}`,
        borderRadius:'var(--radius-chip)',font:'var(--weight-medium) var(--text-body-sm)/1 var(--font-ui)',
        cursor:'pointer',transition:'var(--transition-control)',...style}} {...rest}>
      {icon&&<Icon name={icon} size={15}/>}{children}
      {removable&&<Icon name="x" size={14} style={{opacity:.6,marginLeft:2}} onClick={(e)=>{e.stopPropagation();onRemove&&onRemove()}}/>}
    </button>
  );
}
