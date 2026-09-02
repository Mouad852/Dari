const __DS=window.DariDesignSystem_d1bbe2||(window.__dsMissingBanner||(window.__dsMissingBanner=(()=>{const d=document.createElement('div');d.textContent='Design-system bundle not loaded (_ds_bundle.js) — components unavailable.';d.style.cssText='position:fixed;inset:auto 0 0 0;z-index:999;padding:12px 20px;background:#B33A2B;color:#fff;font:600 13px/1.4 system-ui,sans-serif;text-align:center';document.addEventListener('DOMContentLoaded',()=>document.body.appendChild(d));return new Proxy({},{get:()=>function Missing(){return null}})})()));
const { Icon } = __DS;

function StatusBar(){
  return <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',height:44,padding:'0 22px',font:'var(--weight-semibold) 13px/1 var(--font-ui)',color:'var(--text-heading)'}}>
    <span>9:41</span>
    <span style={{display:'flex',gap:5,alignItems:'center'}}><Icon name="signal" size={14}/><Icon name="wifi" size={14}/><Icon name="battery-full" size={16}/></span>
  </div>;
}

function TopBar({title,onBack,action}){
  return <div style={{display:'flex',alignItems:'center',gap:'var(--space-4)',height:'var(--nav-h-mobile)',
    padding:'0 var(--gutter-mobile)',background:'var(--surface-card)',borderBottom:'1px solid var(--border-hairline)'}}>
    {onBack&&<button onClick={onBack} aria-label="Retour" style={{border:'none',background:'transparent',padding:0,cursor:'pointer',display:'flex',color:'var(--text-heading)'}}><Icon name="chevron-left" size={24}/></button>}
    <h1 style={{flex:1,font:'var(--type-h2)'}}>{title}</h1>{action}
  </div>;
}

const TABS=[{id:'feed',icon:'search',label:'Explorer'},{id:'saved',icon:'heart',label:'Favoris'},
  {id:'messages',icon:'message-circle',label:'Messages'},{id:'profile',icon:'user-round',label:'Profil'}];

function TabBar({active,onChange,unread}){
  return <div style={{display:'flex',height:'var(--tabbar-h)',background:'var(--surface-card)',
    borderTop:'1px solid var(--border-hairline)',paddingBottom:6}}>
    {TABS.map(t=>{const on=t.id===active;return (
      <button key={t.id} onClick={()=>onChange(t.id)} style={{flex:1,display:'flex',flexDirection:'column',
        alignItems:'center',justifyContent:'center',gap:4,border:'none',background:'transparent',cursor:'pointer',
        color:on?'var(--brand)':'var(--text-subtle)',position:'relative',minHeight:'var(--tap-min)'}}>
        <Icon name={t.icon} size={22}/>
        <span style={{font:`var(--weight-${on?'semibold':'medium'}) var(--text-micro)/1 var(--font-ui)`}}>{t.label}</span>
        {t.id==='messages'&&unread>0&&<span style={{position:'absolute',top:6,right:'calc(50% - 18px)',minWidth:16,height:16,
          borderRadius:'var(--radius-pill)',background:'var(--brand)',color:'#fff',
          font:'var(--weight-bold) 10px/16px var(--font-ui)',textAlign:'center',padding:'0 4px'}}>{unread}</span>}
      </button>);})}
  </div>;
}

function Phone({children}){
  return <div style={{width:390,height:844,margin:'0 auto',background:'var(--bg-page)',
    borderRadius:44,border:'10px solid var(--sable-900)',boxShadow:'var(--shadow-lg)',overflow:'hidden',
    position:'relative',display:'flex',flexDirection:'column'}}>{children}</div>;
}

Object.assign(window,{StatusBar,TopBar,TabBar,Phone,TABS});
