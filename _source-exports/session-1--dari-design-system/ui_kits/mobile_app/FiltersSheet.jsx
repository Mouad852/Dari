const __DS=window.DariDesignSystem_d1bbe2||(window.__dsMissingBanner||(window.__dsMissingBanner=(()=>{const d=document.createElement('div');d.textContent='Design-system bundle not loaded (_ds_bundle.js) — components unavailable.';d.style.cssText='position:fixed;inset:auto 0 0 0;z-index:999;padding:12px 20px;background:#B33A2B;color:#fff;font:600 13px/1.4 system-ui,sans-serif;text-align:center';document.addEventListener('DOMContentLoaded',()=>document.body.appendChild(d));return new Proxy({},{get:()=>function Missing(){return null}})})()));
const { Dialog, Button, Tag, Select, Input, Checkbox, Tabs } = __DS;

function FiltersSheet({open,onClose,onApply}){
  const [type,setType]=React.useState('Chambre');
  const [picked,setPicked]=React.useState(['Wi-Fi']);
  const toggle=(t)=>setPicked(p=>p.includes(t)?p.filter(x=>x!==t):[...p,t]);
  return <Dialog open={open} sheet title="Filtres" onClose={onClose}
    footer={<Button fullWidth onClick={onApply}>Voir 32 annonces</Button>}>
    <div style={{display:'grid',gap:'var(--space-5)',paddingBottom:'var(--space-2)'}}>
      <Tabs variant="segmented" value={type} onChange={setType} tabs={['Chambre','Logement entier','Coliving']}/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'var(--space-4)'}}>
        <Input label="Budget min." suffix="MAD" placeholder="2 000"/>
        <Input label="Budget max." suffix="MAD" placeholder="4 500"/>
      </div>
      <Select label="Ville" options={['Rabat','Casablanca','Marrakech','Tanger']} value="Rabat" onChange={()=>{}}/>
      <div>
        <span style={{display:'block',font:'var(--type-label)',color:'var(--text-heading)',marginBottom:'var(--space-3)'}}>Équipements</span>
        <div style={{display:'flex',gap:'var(--space-3)',flexWrap:'wrap'}}>
          {[['Wi-Fi','wifi'],['Meublé','bed-double'],['Lave-linge','washing-machine'],['Parking','car'],['Terrasse','sun']].map(([l,i])=>
            <Tag key={l} icon={i} selected={picked.includes(l)} onClick={()=>toggle(l)}>{l}</Tag>)}
        </div>
      </div>
      <Checkbox label="Charges incluses" description="Eau, électricité, internet" checked/>
    </div>
  </Dialog>;
}

Object.assign(window,{FiltersSheet});
