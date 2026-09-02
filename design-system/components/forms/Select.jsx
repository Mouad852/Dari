import React from 'react';
import { Icon } from '../core/Icon.jsx';

/** Native select styled to match Input. */
export function Select({label,options=[],value,onChange,placeholder='Choisir…',helper,disabled=false,style,...rest}){
  return (
    <label style={{display:'block',...style}}>
      {label&&<span style={{display:'block',font:'var(--type-label)',color:'var(--text-heading)',marginBottom:'var(--space-2)'}}>{label}</span>}
      <span style={{position:'relative',display:'block'}}>
        <select value={value} onChange={onChange} disabled={disabled}
          style={{appearance:'none',width:'100%',height:'var(--control-h-md)',padding:'0 40px 0 14px',
            background:disabled?'var(--sable-100)':'var(--surface-card)',border:'1px solid var(--border-hairline)',
            borderRadius:'var(--radius-control)',boxShadow:'var(--shadow-xs)',font:'var(--type-body)',
            color:value?'var(--text-heading)':'var(--text-subtle)',cursor:'pointer'}} {...rest}>
          <option value="">{placeholder}</option>
          {options.map(o=>{const v=typeof o==='string'?o:o.value,l=typeof o==='string'?o:o.label;
            return <option key={v} value={v}>{l}</option>})}
        </select>
        <Icon name="chevron-down" size={18} color="var(--text-muted)"
          style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}/>
      </span>
      {helper&&<span style={{display:'block',marginTop:'var(--space-2)',font:'var(--type-caption)',color:'var(--text-muted)'}}>{helper}</span>}
    </label>
  );
}
