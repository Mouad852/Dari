import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { IconButton } from '../core/IconButton.jsx';
import { Badge } from '../core/Badge.jsx';

/** The product's signature card: photo, price, location, flatmate meta. */
export function ListingCard({image,title,city,district,price,period='mois',badge,badgeTone='brand',
  flatmates,rating,saved=false,onSave,onClick,layout='vertical',style,...rest}){
  const [h,setH]=React.useState(false);
  const row=layout==='horizontal';
  return (
    <div onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{display:'flex',flexDirection:row?'row':'column',gap:row?'var(--space-4)':0,
        background:'var(--surface-card)',border:'1px solid var(--border-hairline)',
        borderRadius:'var(--radius-card)',overflow:'hidden',cursor:'pointer',
        boxShadow:h?'var(--shadow-md)':'var(--shadow-sm)',transform:h?'translateY(-2px)':'none',
        transition:'box-shadow var(--dur-med) var(--ease-standard),transform var(--dur-med) var(--ease-standard)',...style}} {...rest}>
      <div style={{position:'relative',flex:row?'0 0 116px':'none',
        aspectRatio:row?'1 / 1':'4 / 3',background:image?`center/cover no-repeat url(${image})`:'var(--sable-200)',
        borderRadius:row?'var(--radius-card-inner)':0,margin:row?'var(--space-4) 0 var(--space-4) var(--space-4)':0}}>
        {!image&&<span style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',
          color:'var(--sable-400)',font:'var(--type-caption)',letterSpacing:'var(--ls-caps)',textTransform:'uppercase'}}>Photo</span>}
        {!row&&<div style={{position:'absolute',inset:0,background:'var(--scrim-image)'}}/>}
        {badge&&<Badge tone={badgeTone} size="sm" style={{position:'absolute',top:10,left:10,background:'var(--surface-glass)',backdropFilter:'var(--blur-glass)',border:'none'}}>{badge}</Badge>}
        {!row&&<IconButton icon="heart" variant="glass" size="sm" active={saved} label="Enregistrer"
          onClick={e=>{e.stopPropagation();onSave&&onSave()}} style={{position:'absolute',top:8,right:8}}/>}
      </div>
      <div style={{flex:1,minWidth:0,padding:row?'var(--space-4) var(--space-4) var(--space-4) 0':'var(--card-pad)'}}>
        <div style={{display:'flex',alignItems:'baseline',gap:'var(--space-3)'}}>
          <h3 style={{flex:1,minWidth:0,font:'var(--type-h3)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{title}</h3>
          {rating!=null&&<span style={{display:'inline-flex',alignItems:'center',gap:3,font:'var(--type-caption)',color:'var(--text-body)'}}>
            <Icon name="star" size={13} color="var(--sand-400)"/>{rating}</span>}
        </div>
        <p style={{display:'flex',alignItems:'center',gap:4,marginTop:4,font:'var(--type-caption)',color:'var(--text-muted)'}}>
          <Icon name="map-pin" size={13}/>{district?`${district}, ${city}`:city}</p>
        <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:'var(--space-4)',marginTop:'var(--space-4)'}}>
          <span style={{font:'var(--type-price)',color:'var(--text-price)'}}>
            {price}<span style={{font:'var(--type-caption)',color:'var(--text-muted)',marginLeft:4}}>MAD/{period}</span></span>
          {flatmates&&<span style={{display:'inline-flex',alignItems:'center',gap:4,font:'var(--type-caption)',color:'var(--text-muted)'}}>
            <Icon name="users-round" size={13}/>{flatmates}</span>}
        </div>
      </div>
    </div>
  );
}
