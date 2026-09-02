const __DS=window.DariDesignSystem_d1bbe2||(window.__dsMissingBanner||(window.__dsMissingBanner=(()=>{const d=document.createElement('div');d.textContent='Design-system bundle not loaded (_ds_bundle.js) — components unavailable.';d.style.cssText='position:fixed;inset:auto 0 0 0;z-index:999;padding:12px 20px;background:#B33A2B;color:#fff;font:600 13px/1.4 system-ui,sans-serif;text-align:center';document.addEventListener('DOMContentLoaded',()=>document.body.appendChild(d));return new Proxy({},{get:()=>function Missing(){return null}})})()));
const { Icon, Tag, ListingCard, IconButton, Badge, Card } = __DS;

const LISTINGS=[
  {id:1,title:'Chambre lumineuse',district:'Agdal',city:'Rabat',price:'3 200',flatmates:'2 colocataires',rating:'4,8',badge:'Nouveau'},
  {id:2,title:'Studio Gauthier',district:'Gauthier',city:'Casablanca',price:'5 400',rating:'4,6'},
  {id:3,title:'Chambre en médina',district:'Médina',city:'Marrakech',price:'2 400',flatmates:'3 colocataires',rating:'4,9'},
  {id:4,title:'Coliving Malabata',district:'Malabata',city:'Tanger',price:'4 100',badge:'Vérifié',badgeTone:'success'}
];
const FILTERS=[{label:'Rabat',icon:'map-pin'},{label:'Moins de 4 000 MAD',icon:'wallet'},{label:'Meublé',icon:'bed-double'},{label:'Wi-Fi',icon:'wifi'},{label:'Femmes uniquement',icon:'users-round'}];

function SearchHeader({onOpenFilters,city,count}){
  return <div style={{background:'var(--surface-card)',borderBottom:'1px solid var(--border-hairline)',paddingBottom:'var(--space-4)'}}>
    <div style={{display:'flex',alignItems:'center',gap:'var(--space-4)',padding:'var(--space-4) var(--gutter-mobile) var(--space-3)'}}>
      <span style={{flex:1,display:'flex',alignItems:'center',gap:'var(--space-3)',height:44,padding:'0 14px',
        background:'var(--bg-inset)',border:'1px solid var(--border-hairline)',borderRadius:'var(--radius-pill)'}}>
        <Icon name="search" size={18} color="var(--text-subtle)"/>
        <span style={{flex:1,font:'var(--type-body)',color:'var(--text-heading)'}}>{city}</span>
        <span style={{font:'var(--type-caption)',color:'var(--text-muted)'}}>{count} annonces</span>
      </span>
      <IconButton icon="sliders-horizontal" label="Filtres" onClick={onOpenFilters}/>
    </div>
    <div style={{display:'flex',gap:'var(--space-3)',padding:'0 var(--gutter-mobile)',overflowX:'auto'}}>
      {FILTERS.map((f,i)=><Tag key={f.label} icon={f.icon} selected={i===0} style={{flex:'0 0 auto'}}>{f.label}</Tag>)}
    </div>
  </div>;
}

function FeedScreen({onOpen,onOpenFilters,saved,onSave}){
  return <div style={{flex:1,overflowY:'auto'}}>
    <SearchHeader city="Rabat" count={32} onOpenFilters={onOpenFilters}/>
    <div style={{padding:'var(--space-5) var(--gutter-mobile) var(--space-8)',display:'grid',gap:'var(--space-5)'}}>
      <Card padding="var(--space-4)" elevation="xs" style={{display:'flex',gap:'var(--space-4)',alignItems:'center',background:'var(--brand-subtle)',borderColor:'var(--brand-border)'}}>
        <span style={{display:'flex',width:36,height:36,borderRadius:'var(--radius-pill)',background:'var(--surface-card)',alignItems:'center',justifyContent:'center',color:'var(--brand)'}}><Icon name="sparkles" size={18}/></span>
        <span style={{flex:1}}>
          <span style={{display:'block',font:'var(--type-label)',color:'var(--clay-700)'}}>Complétez votre profil</span>
          <span style={{display:'block',font:'var(--type-caption)',color:'var(--clay-600)'}}>Les profils complets reçoivent 3× plus de réponses.</span>
        </span>
        <Icon name="chevron-right" size={18} color="var(--clay-600)"/>
      </Card>
      <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between'}}>
        <h2 style={{font:'var(--type-h2)'}}>Chambres à Rabat</h2>
        <span style={{font:'var(--type-caption)',color:'var(--text-muted)'}}>Trier</span>
      </div>
      {LISTINGS.map(l=><ListingCard key={l.id} {...l} saved={!!saved[l.id]} onSave={()=>onSave(l.id)} onClick={()=>onOpen(l)}/>)}
    </div>
  </div>;
}

function SavedScreen({saved,onOpen}){
  const items=LISTINGS.filter(l=>saved[l.id]);
  return <div style={{flex:1,overflowY:'auto',padding:'var(--space-5) var(--gutter-mobile)'}}>
    {items.length===0
      ? <div style={{display:'grid',gap:'var(--space-4)',justifyItems:'center',textAlign:'center',padding:'var(--space-11) 0',color:'var(--text-muted)'}}>
          <Icon name="heart" size={32} color="var(--sable-300)"/>
          <h2 style={{font:'var(--type-h3)',color:'var(--text-heading)'}}>Aucun favori</h2>
          <p style={{font:'var(--type-body-sm,13px)',maxWidth:240}}>Touchez le cœur sur une annonce pour la retrouver ici.</p>
        </div>
      : <div style={{display:'grid',gap:'var(--space-4)'}}>
          {items.map(l=><ListingCard key={l.id} layout="horizontal" {...l} onClick={()=>onOpen(l)}/>)}
        </div>}
  </div>;
}

Object.assign(window,{FeedScreen,SavedScreen,LISTINGS});
