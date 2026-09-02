Switch between sections. Underline for page level, segmented inside cards and sheets.

```jsx
<Tabs tabs={[{value:'all',label:'Toutes',count:24},{value:'saved',label:'Enregistrées'}]} value={tab} onChange={setTab}/>
<Tabs variant="segmented" tabs={['Chambre','Logement entier']} />
```
