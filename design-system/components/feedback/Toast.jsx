import React from 'react';
import { Icon } from '../core/Icon.jsx';

const TONES={neutral:{bg:'var(--surface-inverse)',fg:'var(--text-on-inverse)',icon:'info'},
  success:{bg:'var(--atlas-500)',fg:'#fff',icon:'check'},
  danger:{bg:'var(--rose-500)',fg:'#fff',icon:'triangle-alert'}};

/** Transient confirmation, bottom-anchored above the tab bar. */
export function Toast({children,tone='neutral',icon,action,onAction,style,...rest}){
  const t=TONES[tone]||TONES.neutral;
  return <div role="status" style={{display:'inline-flex',alignItems:'center',gap:'var(--space-4)',
    padding:'12px 16px',background:t.bg,color:t.fg,borderRadius:'var(--radius-md)',
    boxShadow:'var(--shadow-lg)',font:'var(--weight-medium) var(--text-body-sm)/1.4 var(--font-ui)',
    animation:'dari-toast-in var(--dur-med) var(--ease-out)',...style}} {...rest}>
    <Icon name={icon||t.icon} size={18}/>
    <span style={{flex:1}}>{children}</span>
    {action&&<button type="button" onClick={onAction} style={{border:'none',background:'transparent',
      color:'inherit',font:'var(--weight-bold) var(--text-body-sm)/1 var(--font-ui)',
      textDecoration:'underline',cursor:'pointer',padding:0}}>{action}</button>}
  </div>;
}
