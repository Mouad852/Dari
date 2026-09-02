import React from 'react';

const CDN='https://unpkg.com/lucide-static@0.441.0/icons/';

/** Lucide glyph rendered as a currentColor mask so it inherits text color. */
export function Icon({name='home',size=20,strokeWidth,color='currentColor',style,...rest}){
  const url=`url("${CDN}${name}.svg")`;
  return <span aria-hidden="true" {...rest} style={{display:'inline-block',flex:'0 0 auto',width:size,height:size,backgroundColor:color,WebkitMaskImage:url,maskImage:url,WebkitMaskRepeat:'no-repeat',maskRepeat:'no-repeat',WebkitMaskSize:'contain',maskSize:'contain',WebkitMaskPosition:'center',maskPosition:'center',...style}}/>;
}
