const __DS=window.DariDesignSystem_d1bbe2||(window.__dsMissingBanner||(window.__dsMissingBanner=(()=>{const d=document.createElement('div');d.textContent='Design-system bundle not loaded (_ds_bundle.js) — components unavailable.';d.style.cssText='position:fixed;inset:auto 0 0 0;z-index:999;padding:12px 20px;background:#B33A2B;color:#fff;font:600 13px/1.4 system-ui,sans-serif;text-align:center';document.addEventListener('DOMContentLoaded',()=>document.body.appendChild(d));return new Proxy({},{get:()=>function Missing(){return null}})})()));
const { Icon, Badge, Button, Card, Switch, Tabs } = __DS;

function ProfileScreen(){
  const [alerts,setAlerts]=React.useState(true);
  const [visible,setVisible]=React.useState(true);
  return <div style={{flex:1,overflowY:'auto',padding:'var(--space-6) var(--gutter-mobile) var(--space-8)',display:'grid',gap:'var(--space-6)'}}>
    <div style={{display:'flex',gap:'var(--space-5)',alignItems:'center'}}>
      <span style={{width:72,height:72,borderRadius:'var(--radius-avatar)',background:'var(--clay-100)',
        display:'flex',alignItems:'center',justifyContent:'center',font:'var(--weight-extra) 26px/1 var(--font-display)',color:'var(--clay-700)'}}>S</span>
      <span style={{flex:1}}>
        <span style={{display:'block',font:'var(--type-h2)',color:'var(--text-heading)'}}>Salma B.</span>
        <span style={{display:'block',font:'var(--type-caption)',color:'var(--text-muted)',marginTop:2}}>Rabat · cherche une chambre</span>
        <span style={{display:'inline-flex',marginTop:8}}><Badge tone="success" size="sm" icon="shield-check">Identité vérifiée</Badge></span>
      </span>
    </div>
    <Card padding="var(--space-5)" style={{display:'grid',gap:'var(--space-4)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
        <h3 style={{font:'var(--type-h3)'}}>Profil de recherche</h3>
        <Button variant="ghost" size="sm">Modifier</Button>
      </div>
      {[['Budget','3 000 – 4 000 MAD'],['Villes','Rabat, Salé'],['Emménagement','1er septembre'],['Durée','12 mois']].map(([k,v])=>
        <span key={k} style={{display:'flex',justifyContent:'space-between',gap:12,font:'var(--type-body-sm,13px)'}}>
          <span style={{color:'var(--text-muted)'}}>{k}</span><span style={{color:'var(--text-heading)',fontWeight:'var(--weight-semibold)'}}>{v}</span></span>)}
    </Card>
    <Card padding="var(--space-5)" style={{display:'grid',gap:'var(--space-2)'}}>
      <Switch label="Alertes nouvelles annonces" description="Une notification par jour maximum" checked={alerts} onChange={()=>setAlerts(!alerts)}/>
      <span style={{height:1,background:'var(--border-hairline)',margin:'var(--space-2) 0'}}/>
      <Switch label="Profil visible par les propriétaires" checked={visible} onChange={()=>setVisible(!visible)}/>
    </Card>
    <div style={{display:'grid',gap:'var(--space-1)'}}>
      {[['file-text','Mes documents'],['credit-card','Paiements'],['circle-help','Aide et sécurité'],['log-out','Se déconnecter']].map(([i,l])=>
        <button key={l} style={{display:'flex',alignItems:'center',gap:'var(--space-4)',minHeight:'var(--tap-min)',
          padding:'0 var(--space-2)',border:'none',background:'transparent',cursor:'pointer',
          font:'var(--type-body)',color:l==='Se déconnecter'?'var(--danger)':'var(--text-body)',textAlign:'left'}}>
          <Icon name={i} size={20} color={l==='Se déconnecter'?'var(--danger)':'var(--text-muted)'}/>
          <span style={{flex:1}}>{l}</span><Icon name="chevron-right" size={18} color="var(--text-subtle)"/></button>)}
    </div>
  </div>;
}

Object.assign(window,{ProfileScreen});
