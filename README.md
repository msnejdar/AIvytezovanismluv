# AI Intelligence Search

Interní nástroj pro inteligentní vyhledávání v dokumentech postavený na Reactu a Vite.

- Frontend: React + Vite (HMR, moderní build tooling)
- API proxy: Vercel/Express endpoint `api/search`
- LLM integrace: Claude (Anthropic) s bezpečným předáním API klíče přes environment proměnné

## Lokální spuštění

```bash
npm install
npm run dev
```

Backend (pokud potřebuješ lokálně proxy):
```bash
npm run server
```

## Nasazení

- Vercel Project → `AIvytezovanismluv`
- `VITE_CLAUDE_API_KEY` nastav jako environment proměnnou
- Build: `npm run build`, output `dist`
