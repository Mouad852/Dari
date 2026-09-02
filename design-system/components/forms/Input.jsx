import React from 'react';
import { Icon } from '../core/Icon.jsx';

/** Text field with warm inset surface, optional leading icon, label and helper text. */
export function Input({label,placeholder,value,onChange,type='text',iconLeft,suffix,error,helper,disabled=false,size='md',style,...rest}){
  const [foc,setFoc]=React.useState(false);
  const h=size==='lg'?'var(--control-h-lg)':size==='sm'?'var(--control-h-sm)':'var(--control-h-md)';
  return (
    <label style={{display:'block',...style}}>
      {label&&<span style={{display:'block',font:'var(--type-label)',color:'var(--text-heading)',marginBottom:'var(--space-2)'}}>{label}</span>}
      <span style={{display:'flex',alignItems:'center',gap:'var(--space-3)',height:h,padding:'0 14px',
        background:disabled?'var(--sable-100)':'var(--surface-card)',
        border:`1px solid ${error?'var(--danger)':foc?'var(--border-focus)':'var(--border-hairline)'}`,
        borderRadius:'var(--radius-control)',boxShadow:foc?'var(--focus-ring)':'var(--shadow-xs)',
        transition:'var(--transition-control)'}}>
        {iconLeft&&<Icon name={iconLeft} size={18} color="var(--text-subtle)"/>}
        <input type={type} value={value} placeholder={placeholder} disabled={disabled}
          onChange={onChange} onFocus={()=>setFoc(true)} onBlur={()=>setFoc(false)}
          style={{flex:1,minWidth:0,border:'none',outline:'none',background:'transparent',
            font:'var(--type-body)',color:'var(--text-heading)'}} {...rest}/>
        {suffix&&<span style={{font:'var(--type-caption)',color:'var(--text-muted)'}}>{suffix}</span>}
      </span>
      {(error||helper)&&<span style={{display:'block',marginTop:'var(--space-2)',font:'var(--type-caption)',
        color:error?'var(--danger)':'var(--text-muted)'}}>{error||helper}</span>}
    </label>
  );
}
