# Drewvidend 💚%

PWA mobile-first per investire in **dividendi della Borsa Italiana**. Lista completa dei
titoli italiani, filtri, watchlist, confronto, calendario stacchi e **motore di segnali**
che analizza i titoli seguiti (sotto media + ex-date vicina, trappole yield, news rilevanti…).

Hostata su **Cloudflare Pages**. Dati da **Yahoo Finance** (interrogato lato server dalle
Pages Functions — nessuna API key richiesta).

## Stack
- React + Vite + Tailwind (PWA installabile, offline-capable)
- Cloudflare Pages + Pages Functions (`functions/api/*`) come proxy verso Yahoo (gestione
  cookie/crumb + cache, così la chiave/credenziali non sono mai nel frontend e si rispettano
  i limiti)
- Universo titoli: `src/data/universe.json` (~378 azioni italiane, rigenerabile)

## Comandi
```bash
npm install

# sviluppo (UI + Functions /api insieme, con hot reload)
npm run dev            # apri http://localhost:8788

# solo UI senza /api (più veloce, ma niente dati di mercato)
npm run dev:ui

# build di produzione + anteprima locale con le Functions
npm run preview        # http://localhost:8788

# deploy su Cloudflare Pages
npm run deploy

# rigenera la lista dei titoli italiani da Yahoo
npm run universe       # richiede Python
```

## Deploy su Cloudflare Pages
1. Push del repo su GitHub.
2. Cloudflare Dashboard → Pages → *Connect to Git* → seleziona il repo.
3. Build command: `npm run build` — Output dir: `dist`.
4. Le Pages Functions in `functions/` vengono pubblicate automaticamente.

Nessuna variabile d'ambiente necessaria (Yahoo non richiede chiave).

## Struttura
```
functions/
  lib/yahoo.js        # cookie+crumb, fetch quote/summary/chart/news, cache
  api/quotes.js       # batch quote (lista)
  api/summary.js      # dettaglio dividendi (yield, ex-date, payout, storico)
  api/news.js         # news del titolo
src/
  data/universe.json  # 378 azioni Borsa Italiana
  lib/                # api client, format IT, signals (motore consigli)
  state/store.jsx     # stato globale + watchlist/note in localStorage
  components/ pages/   # UI mobile (Lista / Watchlist / Confronto / Calendario)
scripts/gen_universe.py
```

## Note
- I dati Yahoo sono *delayed* (~15 min) e non ufficiali: ottimi per analisi/allenamento,
  non per trading ad alta frequenza.
- Le micro-cap EGM possono avere dati dividendo incompleti: vengono mostrate comunque con
  badge "dati n/d".
- Rendimenti mostrati lordi e **netti (−26% tassazione IT)**.
