# Stoplantão — instruções para agentes (Codex e Claude)

## Divisão do trabalho

- `frontend/` — feito pelo Claude. Funciona sozinho no modo treino (bots).
- `backend/` — servidor WebSocket Node + TypeScript que reutiliza o motor do jogo.

## Regras

- O contrato está em `frontend/src/game/types.ts` e `docs/BACKEND_CONTRACT.md`.
  Mudou um tipo, um intent ou um evento? Atualize os dois lados e o documento no mesmo commit.
- O motor (`frontend/src/game/engine.ts`, `rules.ts`) é puro: sem DOM, sem `Date.now()`, sem `Math.random()`.
  O backend deve reutilizar esse código (copiar ou importar), não reescrever as regras.
- O servidor é a autoridade. Sempre envie `viewFor(state, playerId)`, nunca o estado cru.
- Não renomeie arquivos de `frontend/public/assets/`. Os IDs de personagens e de falas são usados nos dois lados.
- Fotos em `reference/` são de pessoas reais do time. Esse acervo e `assets-source/` ficam apenas locais; não publique essas pastas nem o histórico privado que as contém.
- Textos da interface em português do Brasil.

## Comandos

```bash
cd frontend && npm install && npm run dev     # dev
cd frontend && npm run build                  # typecheck + build
cd frontend && npm run lint                   # oxlint
cd frontend && npm test                       # contrato e motor
cd backend && npm ci && npm run dev            # servidor WebSocket
cd backend && npm test && npm run build        # testes + typecheck + bundle
```

## Depuração

Em dev, o estado fica em `window.__game.getState()` no console do navegador.
