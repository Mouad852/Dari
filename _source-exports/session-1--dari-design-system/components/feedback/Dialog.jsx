import React from 'react';
import { IconButton } from '../core/IconButton.jsx';

/** Modal dialog — centred card on desktop, bottom sheet on mobile. */
export function Dialog({open=true,title,children,footer,onClose,sheet=false,width=440,style,...rest}){
  if(!open)return null;
  return (
    <div style={{position:'absolute',inset:0,display:'flex',alignItems:sheet?'flex-end':'center',
      justifyContent:'center',background:'var(--surface-scrim)',backdropFilter:'blur(2px)',
      padding:sheet?0:'var(--space-5)',zIndex:50}} onClick={onClose}>
      <div role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}
        style={{width:sheet?'100%':width,maxWidth:'100%',background:'var(--surface-card)',
          borderRadius:sheet?'var(--radius-sheet) var(--radius-sheet) 0 0':'var(--radius-xl)',
          boxShadow:sheet?'var(--shadow-sheet)':'var(--shadow-lg)',
          animation:sheet?'dari-sheet-in var(--dur-sheet) var(--ease-out)':'dari-pop-in var(--dur-med) var(--ease-out)',
          overflow:'hidden',...style}} {...rest}>
        {sheet&&<div style={{display:'flex',justifyContent:'center',paddingTop:10}}>
          <span style={{width:40,height:4,borderRadius:'var(--radius-pill)',background:'var(--sable-300)'}}/></div>}
        <div style={{display:'flex',alignItems:'flex-start',gap:'var(--space-4)',
          padding:'var(--space-6) var(--space-6) var(--space-4)'}}>
          <h2 style={{flex:1,font:'var(--type-h2)'}}>{title}</h2>
          {onClose&&<IconButton icon="x" size="sm" variant="ghost" label="Fermer" onClick={onClose}/>}
        </div>
        <div style={{padding:'0 var(--space-6)',font:'var(--type-body)',color:'var(--text-body)'}}>{children}</div>
        {footer&&<div style={{display:'flex',gap:'var(--space-4)',justifyContent:'flex-end',
          padding:'var(--space-6)',marginTop:'var(--space-5)'}}>{footer}</div>}
      </div>
    </div>
  );
}
