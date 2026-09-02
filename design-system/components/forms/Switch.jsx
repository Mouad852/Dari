import React from 'react';

/** Instant-apply toggle — settings and filter refinements. */
export function Switch({label,description,checked=false,onChange,disabled=false,style,...rest}){
  return (
    <label style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'var(--space-5)',
      minHeight:'var(--tap-min)',cursor:disabled?'not-allowed':'pointer',opacity:disabled?.6:1,...style}}>
      <span>
        <span style={{display:'block',font:'var(--type-body)',color:'var(--text-heading)'}}>{label}</span>
        {description&&<span style={{display:'block',font:'var(--type-caption)',color:'var(--text-muted)',marginTop:2}}>{description}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={onChange} disabled={disabled}
        style={{position:'absolute',opacity:0,width:0,height:0}} {...rest}/>
      <span style={{flex:'0 0 auto',position:'relative',width:48,height:28,borderRadius:'var(--radius-pill)',
        background:checked?'var(--brand)':'var(--sable-300)',boxShadow:'inset 0 1px 2px rgba(58,42,32,.12)',
        transition:`background-color var(--dur-med) var(--ease-standard)`}}>
        <span style={{position:'absolute',top:3,left:checked?23:3,width:22,height:22,borderRadius:'var(--radius-pill)',
          background:'#fff',boxShadow:'var(--shadow-sm)',transition:`left var(--dur-med) var(--ease-out)`}}/>
      </span>
    </label>
  );
}
