const __DS=window.DariDesignSystem_d1bbe2||(window.__dsMissingBanner||(window.__dsMissingBanner=(()=>{const d=document.createElement('div');d.textContent='Design-system bundle not loaded (_ds_bundle.js) — components unavailable.';d.style.cssText='position:fixed;inset:auto 0 0 0;z-index:999;padding:12px 20px;background:#B33A2B;color:#fff;font:600 13px/1.4 system-ui,sans-serif;text-align:center';document.addEventListener('DOMContentLoaded',()=>document.body.appendChild(d));return new Proxy({},{get:()=>function Missing(){return null}})})()));
const { Icon, Button, Card, Tag, Tabs, ListingCard, Select, Input, Checkbox, Switch, Badge } = __DS;

function FilterRail(){
  const [picked,setPicked]=React.useState(['Wi-Fi']);
  const toggle=t=>setPicked(p=>p.includes(t)?p.filter(x=>x!==t):[...p,t]);
  return <aside style={{position:'sticky',top:'calc(var(--nav-h-desktop) + 24px)',display:'grid',gap:'var(--space-6)',alignContent:'start'}}>
    <Card padding="var(--card-pad-lg)" style={{display:'grid',gap:'var(--space-5)'}}>
      <h3 style={{font:'var(--type-h3)'}}>Filtres</h3>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'var(--space-4)'}}>
        <Input label="Min." suffix="MAD" placeholder="2 000"/><Input label="Max." suffix="MAD" placeholder="4 500"/>
      </div>
      <Select label="Quartier" options={['Agdal','Hassan','Hay Riad','Océan']} value="Agdal" onChange={()=>{}}/>
      <div>
        <span style={{display:'block',font:'var(--type-label)',color:'var(--text-heading)',marginBottom:'var(--space-3)'}}>Équipements</span>
        <div style={{display:'flex',gap:'var(--space-3)',flexWrap:'wrap'}}>
          {[['Wi-Fi','wifi'],['Meublé','bed-double'],['Lave-linge','washing-machine'],['Parking','car']].map(([l,i])=>
            <Tag key={l} icon={i} selected={picked.includes(l)} onClick={()=>toggle(l)}>{l}</Tag>)}
        </div>
      </div>
      <span style={{height:1,background:'var(--border-hairline)'}}/>
      <Checkbox label="Charges incluses" checked/>
      <Checkbox label="Colocation féminine"/>
      <Switch label="Annonces vérifiées uniquement" checked/>
      <Button variant="secondary" fullWidth>Réinitialiser</Button>
    </Card>
  </aside>;
}

function SearchResultsPage({onBack,onOpenListing}){
  const [sort,setSort]=React.useState('Pertinence');
  const items=[...window.FEATURED,...window.FEATURED.map(l=>({...l,id:l.id+10}))];
  return <main style={{padding:'var(--space-7) var(--gutter-desktop) var(--space-10)'}}>
    <div style={{maxWidth:'var(--container-max)',margin:'0 auto',display:'grid',gap:'var(--space-6)'}}>
      <div style={{display:'flex',alignItems:'center',gap:'var(--space-4)'}}>
        <Button variant="ghost" size="sm" iconLeft="chevron-left" onClick={onBack}>Accueil</Button>
        <span style={{font:'var(--type-caption)',color:'var(--text-subtle)'}}>Rabat · Chambre · moins de 4 000 MAD</span>
      </div>
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:'var(--space-5)'}}>
        <div>
          <h1 style={{font:'var(--weight-bold) 32px/1.2 var(--font-display)'}}>412 chambres à Rabat</h1>
          <p style={{marginTop:6,font:'var(--type-body-sm,13px)',color:'var(--text-muted)'}}>Mises à jour aujourd'hui · loyers charges comprises</p>
        </div>
        <Tabs variant="segmented" value={sort} onChange={setSort} tabs={['Pertinence','Prix','Nouveautés']}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'300px 1fr',gap:'var(--space-7)',alignItems:'start'}}>
        <FilterRail/>
        <div style={{display:'grid',gap:'var(--space-5)'}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'var(--space-5)'}}>
            {items.map(l=><ListingCard key={l.id} {...l} onClick={onOpenListing}/>)}
          </div>
          <div style={{display:'flex',justifyContent:'center',paddingTop:'var(--space-4)'}}>
            <Button variant="secondary">Afficher plus d'annonces</Button>
          </div>
        </div>
      </div>
    </div>
  </main>;
}

Object.assign(window,{SearchResultsPage});
