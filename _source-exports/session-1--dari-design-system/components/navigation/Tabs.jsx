import React from 'react';

/** Underlined tab bar for switching content sections. */
export function Tabs({tabs=[],value,onChange,variant='underline',style,...rest}){
  const items=tabs.map(t=>typeof t==='string'?{value:t,label:t}:t);
  const active=value??items[0]?.value;
  if(variant==='segmented'){
    return <div role="tablist" style={{display:'inline-flex',gap:4,padding:4,background:'var(--bg-inset)',
      borderRadius:'var(--radius-pill)',...style}} {...rest}>
      {items.map(t=>{const on=t.value===active;
        return <button key={t.value} role="tab" aria-selected={on} onClick={()=>onChange&&onChange(t.value)}
          style={{height:36,padding:'0 16px',border:'none',borderRadius:'var(--radius-pill)',
            background:on?'var(--surface-card)':'transparent',boxShadow:on?'var(--shadow-xs)':'none',
            color:on?'var(--text-heading)':'var(--text-muted)',
            font:`var(--weight-semibold) var(--text-body-sm)/1 var(--font-ui)`,cursor:'pointer',
            transition:'var(--transition-control)'}}>{t.label}</button>})}
    </div>;
  }
  return <div role="tablist" style={{display:'flex',gap:'var(--space-7)',
    borderBottom:'1px solid var(--border-hairline)',...style}} {...rest}>
    {items.map(t=>{const on=t.value===active;
      return <button key={t.value} role="tab" aria-selected={on} onClick={()=>onChange&&onChange(t.value)}
        style={{position:'relative',padding:'0 0 12px',border:'none',background:'transparent',
          color:on?'var(--text-heading)':'var(--text-muted)',
          font:`var(--weight-semibold) var(--text-body-md)/1.2 var(--font-ui)`,cursor:'pointer',
          boxShadow:on?'inset 0 -2px 0 var(--brand)':'none',transition:'var(--transition-control)'}}>
        {t.label}{t.count!=null&&<span style={{marginLeft:6,font:'var(--type-caption)',color:'var(--text-subtle)'}}>{t.count}</span>}
      </button>})}
  </div>;
}
