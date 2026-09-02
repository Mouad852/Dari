const __DS=window.DariDesignSystem_d1bbe2||(window.__dsMissingBanner||(window.__dsMissingBanner=(()=>{const d=document.createElement('div');d.textContent='Design-system bundle not loaded (_ds_bundle.js) — components unavailable.';d.style.cssText='position:fixed;inset:auto 0 0 0;z-index:999;padding:12px 20px;background:#B33A2B;color:#fff;font:600 13px/1.4 system-ui,sans-serif;text-align:center';document.addEventListener('DOMContentLoaded',()=>document.body.appendChild(d));return new Proxy({},{get:()=>function Missing(){return null}})})()));
const { Icon, Button, Card, Badge, Tag, ListingCard, Select, Input, Tabs } = __DS;

const CITIES=[['Rabat','412 chambres'],['Casablanca','938 chambres'],['Marrakech','307 chambres'],['Tanger','186 chambres']];
const FEATURED=[
  {id:1,title:'Chambre lumineuse',district:'Agdal',city:'Rabat',price:'3 200',flatmates:'2 colocataires',rating:'4,8',badge:'Nouveau'},
  {id:2,title:'Studio Gauthier',district:'Gauthier',city:'Casablanca',price:'5 400',rating:'4,6'},
  {id:3,title:'Chambre en médina',district:'Médina',city:'Marrakech',price:'2 400',flatmates:'3 colocataires',rating:'4,9'},
  {id:4,title:'Coliving Malabata',district:'Malabata',city:'Tanger',price:'4 100',badge:'Vérifié',badgeTone:'success'}
];
const STEPS=[['search','Cherchez','Filtrez par quartier, budget et style de vie.'],
  ['shield-check','Vérifiez','Annonces et profils contrôlés avant publication.'],
  ['message-circle','Discutez','Échangez avec le propriétaire et les colocataires.'],
  ['key-round','Emménagez','Bail signé en ligne, caution protégée.']];

function SearchBar({onSearch}){
  return <div style={{display:'flex',gap:'var(--space-3)',alignItems:'flex-end',background:'var(--surface-card)',
    border:'1px solid var(--border-hairline)',borderRadius:'var(--radius-xl)',boxShadow:'var(--shadow-lg)',padding:'var(--space-5)'}}>
    <Select label="Ville" options={['Rabat','Casablanca','Marrakech','Tanger']} value="Rabat" onChange={()=>{}} style={{flex:1}}/>
    <Input label="Budget max." suffix="MAD" placeholder="4 000" style={{flex:1}}/>
    <Select label="Type" options={['Chambre','Logement entier','Coliving']} value="Chambre" onChange={()=>{}} style={{flex:1}}/>
    <Button size="lg" iconLeft="search" onClick={onSearch}>Rechercher</Button>
  </div>;
}

function HomePage({onSearch,onOpenListing}){
  return <main>
    <section style={{position:'relative',padding:'var(--space-11) var(--gutter-desktop) var(--space-10)',
      background:'linear-gradient(180deg,var(--clay-50) 0%,var(--bg-page) 78%)'}}>
      <div style={{maxWidth:'var(--container-max)',margin:'0 auto',display:'grid',gridTemplateColumns:'1.05fr .95fr',gap:'var(--space-9)',alignItems:'center'}}>
        <div style={{display:'grid',gap:'var(--space-5)'}}>
          <span style={{display:'inline-flex',width:'fit-content'}}><Badge tone="brand" icon="shield-check">Annonces vérifiées une par une</Badge></span>
          <h1 style={{font:'var(--weight-extra) 52px/1.08 var(--font-display)',letterSpacing:'var(--ls-display)'}}>Une chambre, des colocataires, une vraie adresse.</h1>
          <p style={{font:'var(--type-body-lg)',color:'var(--text-muted)',maxWidth:520}}>Trouvez une colocation à Rabat, Casablanca, Marrakech ou Tanger — avec des profils vérifiés et des loyers annoncés charges comprises.</p>
          <div style={{display:'flex',gap:'var(--space-4)',alignItems:'center'}}>
            <Button size="lg" onClick={onSearch}>Voir les chambres</Button>
            <Button size="lg" variant="secondary" iconLeft="plus">Publier une annonce</Button>
          </div>
        </div>
        <div style={{height:380,borderRadius:'var(--radius-2xl)',background:'var(--sable-200)',
          display:'flex',alignItems:'center',justifyContent:'center',color:'var(--sable-500)',
          font:'var(--type-caption)',letterSpacing:'var(--ls-caps)',textTransform:'uppercase',boxShadow:'var(--shadow-md)'}}>Photo</div>
      </div>
      <div style={{maxWidth:'var(--container-max)',margin:'var(--space-9) auto 0'}}><SearchBar onSearch={onSearch}/></div>
    </section>

    <section style={{padding:'var(--space-10) var(--gutter-desktop)'}}>
      <div style={{maxWidth:'var(--container-max)',margin:'0 auto',display:'grid',gap:'var(--space-6)'}}>
        <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between'}}>
          <h2 style={{font:'var(--weight-bold) 32px/1.2 var(--font-display)'}}>Chambres en vedette</h2>
          <a href="#" onClick={e=>{e.preventDefault();onSearch()}}>Voir les 1 843 annonces →</a>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'var(--space-5)'}}>
          {FEATURED.map(l=><ListingCard key={l.id} {...l} onClick={onOpenListing}/>)}
        </div>
      </div>
    </section>

    <section style={{padding:'var(--space-10) var(--gutter-desktop)',background:'var(--bg-page-alt)'}}>
      <div style={{maxWidth:'var(--container-max)',margin:'0 auto',display:'grid',gap:'var(--space-6)'}}>
        <h2 style={{font:'var(--weight-bold) 32px/1.2 var(--font-display)'}}>Comment ça marche</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'var(--space-5)'}}>
          {STEPS.map(([i,t,d],n)=><Card key={t} padding="var(--card-pad-lg)" style={{display:'grid',gap:'var(--space-3)',alignContent:'start'}}>
            <span style={{display:'flex',width:44,height:44,borderRadius:'var(--radius-pill)',background:'var(--brand-subtle)',
              alignItems:'center',justifyContent:'center',color:'var(--brand)'}}><Icon name={i} size={20}/></span>
            <span style={{font:'var(--type-eyebrow)',letterSpacing:'var(--ls-caps)',textTransform:'uppercase',color:'var(--text-subtle)'}}>Étape {n+1}</span>
            <h3 style={{font:'var(--type-h3)'}}>{t}</h3>
            <p style={{font:'var(--type-body-sm,13px)',color:'var(--text-muted)'}}>{d}</p>
          </Card>)}
        </div>
      </div>
    </section>

    <section style={{padding:'var(--space-10) var(--gutter-desktop)'}}>
      <div style={{maxWidth:'var(--container-max)',margin:'0 auto',display:'grid',gap:'var(--space-6)'}}>
        <h2 style={{font:'var(--weight-bold) 32px/1.2 var(--font-display)'}}>Explorer par ville</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'var(--space-5)'}}>
          {CITIES.map(([c,n])=><div key={c} style={{position:'relative',height:200,borderRadius:'var(--radius-card)',
            overflow:'hidden',background:'var(--sable-200)',cursor:'pointer'}} onClick={onSearch}>
            <span style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',
              color:'var(--sable-500)',font:'var(--type-caption)',letterSpacing:'var(--ls-caps)',textTransform:'uppercase'}}>Photo</span>
            <span style={{position:'absolute',inset:0,background:'var(--scrim-image)'}}/>
            <span style={{position:'absolute',bottom:14,left:16,color:'#fff'}}>
              <span style={{display:'block',font:'var(--weight-bold) 20px/1.2 var(--font-display)'}}>{c}</span>
              <span style={{display:'block',font:'var(--type-caption)',opacity:.88}}>{n}</span></span>
          </div>)}
        </div>
      </div>
    </section>

    <section style={{padding:'0 var(--gutter-desktop) var(--space-11)'}}>
      <div style={{maxWidth:'var(--container-max)',margin:'0 auto',display:'flex',alignItems:'center',gap:'var(--space-8)',
        background:'var(--clay-500)',borderRadius:'var(--radius-2xl)',padding:'var(--space-9) var(--space-10)',color:'#fff'}}>
        <div style={{flex:1,display:'grid',gap:'var(--space-4)'}}>
          <h2 style={{font:'var(--weight-extra) 34px/1.15 var(--font-display)',color:'#fff',letterSpacing:'var(--ls-display)'}}>Vous avez une chambre libre ?</h2>
          <p style={{font:'var(--type-body-lg)',color:'var(--clay-50)',maxWidth:520}}>Publiez gratuitement, choisissez vos colocataires, encaissez le loyer en ligne.</p>
        </div>
        <Button size="lg" variant="secondary">Publier une annonce</Button>
      </div>
    </section>
  </main>;
}

Object.assign(window,{HomePage,FEATURED});
