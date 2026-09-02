Confirmations, filter panels, contact forms. `sheet` on mobile, centred card on desktop.

```jsx
<Dialog sheet title="Filtres" onClose={close} footer={<Button fullWidth>Voir 32 annonces</Button>}>…</Dialog>
```
Positioned `absolute` — give the parent `position:relative` (or use at page root).
