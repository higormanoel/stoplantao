# Stoplantão — o Stop do time iFH

Jogo de Stop (adedonha) no estilo do [Stopots](https://stopots.com/pt), com a identidade do iFH,
o time inteiro como personagens e a voz do Dr. Felipe comentando cada STOP.

## Rodar

```bash
cd frontend
npm install
npm run dev
```

Abre em `http://localhost:5173`. Sem backend, o jogo roda no **modo treino**: os outros
colaboradores entram como bots, respondem, dão STOP e votam.

## Como funciona

1. **Entrar no plantão** → **Quem é você?** (escolha seu personagem).
2. **Jogar** (sala rápida com 5 colegas) ou **Criar sala** (rodadas, tempo, categorias, quantos colegas).
3. Lobby → sorteio da letra → preencher categorias → **STOP!** → vale ou não vale? → placar → pódio.
4. Pontos: 10 resposta única, 5 repetida, 0 inválida.

## Pastas

```
ADEDONHA/
├── frontend/              app React + TypeScript + Vite (pronto)
│   ├── public/assets/     avatares (WebP), voz (m4a), fonte, logo iFH
│   └── src/
│       ├── game/          motor puro compartilhado pelo navegador e pelo servidor
│       ├── net/           transporte local (bots) e WebSocket (backend)
│       ├── store/         estado da UI (zustand) e reação a eventos
│       ├── audio/         efeitos sintetizados + voz do Dr. Felipe
│       ├── data/          time, categorias, falas, banco de palavras
│       ├── components/    logo, avatar, botões, timer, narrador, overlay de STOP
│       ├── screens/       splash, quem é você, home, sala (lobby → pódio)
│       └── styles/        tokens iFH, base, componentes, telas
├── backend/               servidor WebSocket Node + TypeScript
├── docs/
│   ├── BACKEND_CONTRACT.md  protocolo e regras para o servidor
│   ├── BRAND.md             nome, cores, tipografia, elementos
│   └── ASSETS.md            como os personagens e a voz foram gerados
└── AGENTS.md              instruções de desenvolvimento
```

O repositório público inclui os avatares, a voz, a fonte e a logo usados pelo jogo.
As fotos de referência (`reference/`) e os materiais de produção (`assets-source/`)
ficam apenas no acervo local e não são necessários para rodar ou compilar o projeto.

## Modo online

Use Node.js 22 ou superior. Em um terminal, inicie o servidor:

```bash
cd backend
npm ci
cp .env.example .env
npm run dev
```

Em outro terminal, conecte o frontend:

```bash
cd frontend
VITE_WS_URL=ws://localhost:8787/ws npm run dev
```

Escolha **Criar sala → Sala online**, copie o código e entre em outro navegador
com outro personagem. O botão **Jogar** continua abrindo o treino com bots.

O servidor importa o motor do frontend e mantém salas em memória. Uma única
instância atende todas as salas; reiniciar o processo encerra as partidas.
As sessões usam tokens secretos, e a reconexão preserva a vaga e a pontuação.
Salas sem conexões expiram após 30 minutos.

Para gerar e executar o backend de produção:

```bash
cd backend
npm ci
npm run build
npm start
```

O bundle fica em `backend/dist/server.js` e precisa apenas da dependência `ws`
em execução. O frontend usa `VITE_WS_URL` durante o build; na publicação, configure
a URL `wss://` do servidor. Defina `ALLOWED_ORIGINS` no backend com a origem exata
do frontend. As demais configurações estão em `backend/.env.example`.

Também é possível construir o contêiner com contexto na raiz do repositório:

```bash
docker build -f backend/Dockerfile -t stoplantao-backend .
docker run --rm -p 8787:8787 --env-file backend/.env stoplantao-backend
```

`GET /health` retorna `{ "ok": true }`. O endpoint do jogo é `/ws`.
O serviço precisa de hospedagem que mantenha um processo Node e conexões WebSocket.

Detalhes em [docs/BACKEND_CONTRACT.md](docs/BACKEND_CONTRACT.md).

## Verificar

```bash
cd backend
npm test
npm run build
```

```bash
cd frontend
npm test
npm run simulate
npm run lint
npm run build
```

## Build

```bash
cd frontend
npm run build      # gera frontend/dist (estático, pode ir para Vercel)
```
