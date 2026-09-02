const __DS=window.DariDesignSystem_d1bbe2||(window.__dsMissingBanner||(window.__dsMissingBanner=(()=>{const d=document.createElement('div');d.textContent='Design-system bundle not loaded (_ds_bundle.js) — components unavailable.';d.style.cssText='position:fixed;inset:auto 0 0 0;z-index:999;padding:12px 20px;background:#B33A2B;color:#fff;font:600 13px/1.4 system-ui,sans-serif;text-align:center';document.addEventListener('DOMContentLoaded',()=>document.body.appendChild(d));return new Proxy({},{get:()=>function Missing(){return null}})})()));
const { Icon, Badge, Button, IconButton, Tag, Card, Tabs } = __DS;

const AMENITIES=[{icon:'wifi',label:'Wi-Fi fibre'},{icon:'bed-double',label:'Meublé'},{icon:'washing-machine',label:'Lave-linge'},{icon:'sun',label:'Terrasse'},{icon:'car',label:'Parking'},{icon:'utensils',label:'Cuisine équipée'}];

function ListingScreen({listing,onBack,saved,onSave,onContact}){
  const [tab,setTab]=React.useState('logement');
  return <div style={{flex:1,overflowY:'auto',paddingBottom:96}}>
    <div style={{position:'relative',height:260,background:'var(--sable-200)'}}>
      <span style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',
        color:'var(--sable-500)',font:'var(--type-caption)',letterSpacing:'var(--ls-caps)',textTransform:'uppercase'}}>Photo</span>
      <div style={{position:'absolute',inset:0,background:'var(--scrim-image)'}}/>
      <div style={{position:'absolute',top:12,left:'var(--gutter-mobile)',right:'var(--gutter-mobile)',display:'flex',justifyContent:'space-between'}}>
        <IconButton icon="chevron-left" variant="glass" label="Retour" onClick={onBack}/>
        <span style={{display:'flex',gap:8}}>
          <IconButton icon="share-2" variant="glass" label="Partager"/>
          <IconButton icon="heart" variant="glass" active={saved} label="Enregistrer" onClick={onSave}/>
        </span>
      </div>
      <span style={{position:'absolute',bottom:12,right:'var(--gutter-mobile)',padding:'4px 10px',borderRadius:'var(--radius-pill)',
        background:'var(--surface-glass)',backdropFilter:'var(--blur-glass)',font:'var(--type-caption)',color:'var(--sable-900)'}}>1 / 8</span>
    </div>
    <div style={{padding:'var(--space-6) var(--gutter-mobile)',display:'grid',gap:'var(--space-5)'}}>
      <div style={{display:'grid',gap:'var(--space-3)'}}>
        <div style={{display:'flex',gap:8}}>
          <Badge tone="success" icon="shield-check">Annonce vérifiée</Badge>
          <Badge tone="neutral" size="sm">Disponible 1er sept.</Badge>
        </div>
        <h1 style={{font:'var(--type-h1)'}}>{listing.title} — {listing.district}</h1>
        <p style={{display:'flex',alignItems:'center',gap:6,font:'var(--type-body-sm,13px)',color:'var(--text-muted)'}}>
          <Icon name="map-pin" size={14}/>{listing.district}, {listing.city} · 12 min du tramway</p>
        <div style={{display:'flex',alignItems:'baseline',gap:'var(--space-4)'}}>
          <span style={{font:'var(--weight-bold) 26px/1.2 var(--font-ui)',color:'var(--text-price)'}}>{listing.price}
            <span style={{font:'var(--type-caption)',color:'var(--text-muted)',marginLeft:4}}>MAD/mois</span></span>
          <span style={{font:'var(--type-caption)',color:'var(--text-muted)'}}>charges comprises</span>
        </div>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{value:'logement',label:'Le logement'},{value:'coloc',label:'Colocataires'},{value:'regles',label:'Règles'}]}/>
      {tab==='logement'&&<div style={{display:'grid',gap:'var(--space-5)'}}>
        <p style={{font:'var(--type-body)'}}>Chambre de 14 m² dans un appartement de trois chambres, au calme, à deux pas des cafés de l'avenue. Lumière du matin, balcon partagé, cuisine refaite en 2024.</p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'var(--space-4)'}}>
          {AMENITIES.map(a=><span key={a.label} style={{display:'flex',alignItems:'center',gap:'var(--space-3)',font:'var(--type-body-sm,13px)',color:'var(--text-body)'}}>
            <Icon name={a.icon} size={18} color="var(--text-muted)"/>{a.label}</span>)}
        </div>
      </div>}
      {tab==='coloc'&&<div style={{display:'grid',gap:'var(--space-4)'}}>
        {[['Salma','28 ans · architecte'],['Youssef','31 ans · ingénieur']].map(([n,m])=>
          <Card key={n} padding="var(--space-4)" style={{display:'flex',gap:'var(--space-4)',alignItems:'center'}}>
            <span style={{width:44,height:44,borderRadius:'var(--radius-avatar)',background:'var(--sand-100)',
              display:'flex',alignItems:'center',justifyContent:'center',font:'var(--weight-bold) 16px/1 var(--font-ui)',color:'var(--sand-700)'}}>{n[0]}</span>
            <span style={{flex:1}}><span style={{display:'block',font:'var(--type-label)',color:'var(--text-heading)'}}>{n}</span>
              <span style={{display:'block',font:'var(--type-caption)',color:'var(--text-muted)'}}>{m}</span></span>
            <Badge tone="success" size="sm" icon="shield-check">Vérifié</Badge>
          </Card>)}
      </div>}
      {tab==='regles'&&<div style={{display:'grid',gap:'var(--space-3)'}}>
        {['Non-fumeur à l\'intérieur','Animaux acceptés','Bail minimum 6 mois','Caution : 1 mois'].map(r=>
          <span key={r} style={{display:'flex',gap:'var(--space-3)',alignItems:'center',font:'var(--type-body-sm,13px)'}}>
            <Icon name="check" size={16} color="var(--success)"/>{r}</span>)}
      </div>}
      <Card padding="var(--space-5)" style={{display:'grid',gap:'var(--space-4)'}}>
        <div style={{display:'flex',gap:'var(--space-4)',alignItems:'center'}}>
          <span style={{width:48,height:48,borderRadius:'var(--radius-avatar)',background:'var(--clay-100)',
            display:'flex',alignItems:'center',justifyContent:'center',font:'var(--weight-bold) 17px/1 var(--font-ui)',color:'var(--clay-700)'}}>N</span>
          <span style={{flex:1}}><span style={{display:'block',font:'var(--type-label)',color:'var(--text-heading)'}}>Nadia · propriétaire</span>
            <span style={{display:'block',font:'var(--type-caption)',color:'var(--text-muted)'}}>Répond en moyenne en 2 h</span></span>
          <span style={{display:'flex',alignItems:'center',gap:4,font:'var(--type-caption)'}}><Icon name="star" size={14} color="var(--sand-400)"/>4,8</span>
        </div>
      </Card>
    </div>
    <div style={{position:'absolute',left:0,right:0,bottom:0,display:'flex',gap:'var(--space-4)',alignItems:'center',
      padding:'var(--space-4) var(--gutter-mobile)',background:'var(--surface-glass)',backdropFilter:'var(--blur-glass)',
      borderTop:'1px solid var(--border-hairline)'}}>
      <span><span style={{display:'block',font:'var(--weight-bold) 17px/1.2 var(--font-ui)',color:'var(--text-price)'}}>{listing.price} MAD</span>
        <span style={{display:'block',font:'var(--type-caption)',color:'var(--text-muted)'}}>par mois</span></span>
      <Button iconLeft="message-circle" style={{marginLeft:'auto'}} onClick={onContact}>Contacter</Button>
    </div>
  </div>;
}

Object.assign(window,{ListingScreen});
