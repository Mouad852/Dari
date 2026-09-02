const __DS=window.DariDesignSystem_d1bbe2||(window.__dsMissingBanner||(window.__dsMissingBanner=(()=>{const d=document.createElement('div');d.textContent='Design-system bundle not loaded (_ds_bundle.js) — components unavailable.';d.style.cssText='position:fixed;inset:auto 0 0 0;z-index:999;padding:12px 20px;background:#B33A2B;color:#fff;font:600 13px/1.4 system-ui,sans-serif;text-align:center';document.addEventListener('DOMContentLoaded',()=>document.body.appendChild(d));return new Proxy({},{get:()=>function Missing(){return null}})})()));
const { Icon, Badge, Button, Input, Card } = __DS;

const THREADS=[
  {id:1,name:'Nadia',last:'Bonjour Salma, la chambre est libre à partir du 1er septembre.',time:'09:12',unread:2,initial:'N'},
  {id:2,name:'Youssef',last:'On peut faire une visite jeudi soir si ça vous va.',time:'Hier',unread:0,initial:'Y'},
  {id:3,name:'Coliving Malabata',last:'Merci pour votre message, voici les disponibilités…',time:'Lun',unread:0,initial:'C'}
];

function MessagesScreen({onOpenThread}){
  return <div style={{flex:1,overflowY:'auto'}}>
    {THREADS.map(t=>
      <button key={t.id} onClick={()=>onOpenThread(t)} style={{display:'flex',gap:'var(--space-4)',width:'100%',
        alignItems:'center',padding:'var(--space-4) var(--gutter-mobile)',border:'none',borderBottom:'1px solid var(--border-hairline)',
        background:'var(--surface-card)',textAlign:'left',cursor:'pointer'}}>
        <span style={{width:48,height:48,flex:'0 0 auto',borderRadius:'var(--radius-avatar)',background:'var(--sand-100)',
          display:'flex',alignItems:'center',justifyContent:'center',font:'var(--weight-bold) 17px/1 var(--font-ui)',color:'var(--sand-700)'}}>{t.initial}</span>
        <span style={{flex:1,minWidth:0}}>
          <span style={{display:'flex',justifyContent:'space-between',gap:8}}>
            <span style={{font:'var(--type-label)',color:'var(--text-heading)'}}>{t.name}</span>
            <span style={{font:'var(--type-caption)',color:'var(--text-subtle)'}}>{t.time}</span></span>
          <span style={{display:'block',marginTop:2,font:`var(--weight-${t.unread?'medium':'regular'}) var(--text-body-sm)/var(--lh-snug) var(--font-ui)`,
            color:t.unread?'var(--text-body)':'var(--text-muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.last}</span>
        </span>
        {t.unread>0&&<span style={{flex:'0 0 auto',minWidth:20,height:20,borderRadius:'var(--radius-pill)',background:'var(--brand)',
          color:'#fff',font:'var(--weight-bold) 11px/20px var(--font-ui)',textAlign:'center'}}>{t.unread}</span>}
      </button>)}
  </div>;
}

function ThreadScreen({thread,messages,onSend}){
  const [draft,setDraft]=React.useState('');
  return <div style={{flex:1,display:'flex',flexDirection:'column',minHeight:0}}>
    <div style={{flex:1,overflowY:'auto',padding:'var(--space-5) var(--gutter-mobile)',display:'grid',gap:'var(--space-4)',alignContent:'start'}}>
      <Card padding="var(--space-4)" elevation="xs" style={{display:'flex',gap:'var(--space-4)',alignItems:'center'}}>
        <span style={{width:44,height:44,borderRadius:'var(--radius-card-inner)',background:'var(--sable-200)',
          display:'flex',alignItems:'center',justifyContent:'center',font:'var(--type-micro,11px)',color:'var(--sable-500)'}}>Photo</span>
        <span style={{flex:1}}><span style={{display:'block',font:'var(--type-label)',color:'var(--text-heading)'}}>Chambre lumineuse — Agdal</span>
          <span style={{display:'block',font:'var(--type-caption)',color:'var(--text-muted)'}}>3 200 MAD/mois · Rabat</span></span>
        <Icon name="chevron-right" size={18} color="var(--text-subtle)"/>
      </Card>
      {messages.map((m,i)=>
        <span key={i} style={{maxWidth:'78%',alignSelf:m.me?'flex-end':'flex-start',
          padding:'10px 14px',borderRadius:m.me?'var(--radius-md) var(--radius-md) var(--radius-xs) var(--radius-md)':'var(--radius-md) var(--radius-md) var(--radius-md) var(--radius-xs)',
          background:m.me?'var(--brand)':'var(--surface-card)',color:m.me?'var(--text-on-brand)':'var(--text-body)',
          border:m.me?'none':'1px solid var(--border-hairline)',boxShadow:'var(--shadow-xs)',
          font:'var(--type-body)',animation:'dari-fade-up var(--dur-med) var(--ease-out)'}}>{m.text}</span>)}
    </div>
    <div style={{display:'flex',gap:'var(--space-3)',alignItems:'center',padding:'var(--space-4) var(--gutter-mobile)',
      background:'var(--surface-card)',borderTop:'1px solid var(--border-hairline)'}}>
      <Input placeholder="Écrire un message…" value={draft} onChange={e=>setDraft(e.target.value)} style={{flex:1}}/>
      <Button size="md" iconLeft="send" onClick={()=>{if(draft.trim()){onSend(draft);setDraft('')}}} style={{padding:'0 16px'}}>Envoyer</Button>
    </div>
  </div>;
}

Object.assign(window,{MessagesScreen,ThreadScreen,THREADS});
