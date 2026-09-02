const __DS=window.DariDesignSystem_d1bbe2||(window.__dsMissingBanner||(window.__dsMissingBanner=(()=>{const d=document.createElement('div');d.textContent='Design-system bundle not loaded (_ds_bundle.js) — components unavailable.';d.style.cssText='position:fixed;inset:auto 0 0 0;z-index:999;padding:12px 20px;background:#B33A2B;color:#fff;font:600 13px/1.4 system-ui,sans-serif;text-align:center';document.addEventListener('DOMContentLoaded',()=>document.body.appendChild(d));return new Proxy({},{get:()=>function Missing(){return null}})})()));
const { Icon, Button } = __DS;

function Wordmark({color='var(--clay-600)',size=24}){
  return <span style={{font:`var(--weight-extra) ${size}px/1 var(--font-display)`,letterSpacing:'-.02em',color}}>dari</span>;
}

function SiteHeader({onSearch}){
  return <header style={{position:'sticky',top:0,zIndex:10,height:'var(--nav-h-desktop)',display:'flex',alignItems:'center',
    gap:'var(--space-8)',padding:'0 var(--gutter-desktop)',background:'var(--surface-glass)',
    backdropFilter:'var(--blur-glass)',borderBottom:'1px solid var(--border-hairline)'}}>
    <Wordmark/>
    <nav style={{display:'flex',gap:'var(--space-7)',flex:1}}>
      {['Chambres','Colocataires','Villes','Comment ça marche'].map(l=>
        <a key={l} href="#" style={{font:'var(--weight-medium) var(--text-body-md)/1 var(--font-ui)',color:'var(--text-body)',textDecoration:'none'}}>{l}</a>)}
    </nav>
    <Button variant="ghost" size="sm">Se connecter</Button>
    <Button size="sm" iconLeft="plus" onClick={onSearch}>Publier une annonce</Button>
  </header>;
}

function SiteFooter(){
  const cols=[['Louer',['Chambres à Rabat','Chambres à Casablanca','Colocation à Marrakech','Coliving à Tanger']],
    ['Propriétaires',['Publier une annonce','Tarifs','Vérification','Guide du bail']],
    ['Dari',['À propos','Sécurité','Aide','Presse']]];
  return <footer style={{background:'var(--surface-inverse)',color:'var(--text-on-inverse)',padding:'var(--space-10) var(--gutter-desktop) var(--space-8)'}}>
    <div style={{maxWidth:'var(--container-max)',margin:'0 auto',display:'grid',gridTemplateColumns:'1.4fr repeat(3,1fr)',gap:'var(--space-8)'}}>
      <div style={{display:'grid',gap:'var(--space-4)',alignContent:'start'}}>
        <Wordmark color="#fff" size={26}/>
        <p style={{font:'var(--type-body-sm,13px)',color:'var(--sable-300)',maxWidth:260}}>Des chambres vérifiées et des colocataires de confiance à Rabat, Casablanca, Marrakech et Tanger.</p>
      </div>
      {cols.map(([h,links])=><div key={h} style={{display:'grid',gap:'var(--space-3)',alignContent:'start'}}>
        <span style={{font:'var(--type-eyebrow)',letterSpacing:'var(--ls-caps)',textTransform:'uppercase',color:'var(--sand-300)'}}>{h}</span>
        {links.map(l=><a key={l} href="#" style={{font:'var(--weight-regular) var(--text-body-sm)/1.5 var(--font-ui)',color:'var(--sable-200)',textDecoration:'none'}}>{l}</a>)}
      </div>)}
    </div>
    <div style={{maxWidth:'var(--container-max)',margin:'var(--space-8) auto 0',paddingTop:'var(--space-5)',
      borderTop:'1px solid rgba(255,255,255,.12)',display:'flex',justifyContent:'space-between',
      font:'var(--type-caption)',color:'var(--sable-400)'}}>
      <span>© 2026 Dari · Casablanca, Maroc</span><span>Conditions · Confidentialité</span>
    </div>
  </footer>;
}

Object.assign(window,{SiteHeader,SiteFooter,Wordmark});
