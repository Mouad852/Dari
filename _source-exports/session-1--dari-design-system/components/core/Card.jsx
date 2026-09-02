import React from 'react';

/** Base surface: white, 18px radius, warm hairline + soft shadow. */
export function Card({children,padding='var(--card-pad)',interactive=false,elevation='sm',onClick,style,...rest}){
  const [h,setH]=React.useState(false);
  const sh={none:'none',xs:'var(--shadow-xs)',sm:'var(--shadow-sm)',md:'var(--shadow-md)',lg:'var(--shadow-lg)'}[elevation];
  return <div onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
    style={{background:'var(--surface-card)',border:'1px solid var(--border-hairline)',
      borderRadius:'var(--radius-card)',padding,boxShadow:interactive&&h?'var(--shadow-md)':sh,
      transform:interactive&&h?'translateY(-2px)':'none',
      transition:`box-shadow var(--dur-med) var(--ease-standard),transform var(--dur-med) var(--ease-standard)`,
      cursor:interactive?'pointer':'default',...style}} {...rest}>{children}</div>;
}
