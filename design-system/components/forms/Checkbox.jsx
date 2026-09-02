import React from 'react';
import { Icon } from '../core/Icon.jsx';

/** Square 22px checkbox with terracotta fill when checked. */
export function Checkbox({label,checked=false,onChange,description,disabled=false,style,...rest}){
  return (
    <label style={{display:'flex',alignItems:description?'flex-start':'center',gap:'var(--space-4)',
      cursor:disabled?'not-allowed':'pointer',opacity:disabled?.6:1,minHeight:'var(--tap-min)',...style}}>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled}
        style={{position:'absolute',opacity:0,width:0,height:0}} {...rest}/>
      <span style={{display:'flex',alignItems:'center',justifyContent:'center',flex:'0 0 auto',width:22,height:22,
        marginTop:description?2:0,borderRadius:'var(--radius-xs)',
        background:checked?'var(--brand)':'var(--surface-card)',
        border:`1px solid ${checked?'var(--brand)':'var(--border-default)'}`,
        boxShadow:'var(--shadow-xs)',transition:'var(--transition-control)'}}>
        {checked&&<Icon name="check" size={15} color="#fff"/>}
      </span>
      <span>
        <span style={{display:'block',font:'var(--type-body)',color:'var(--text-heading)'}}>{label}</span>
        {description&&<span style={{display:'block',font:'var(--type-caption)',color:'var(--text-muted)',marginTop:2}}>{description}</span>}
      </span>
    </label>
  );
}
