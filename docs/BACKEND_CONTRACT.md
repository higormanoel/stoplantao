# Contrato do backend — Stoplantão

O modo treino funciona sozinho no front, com bots. O modo online usa o servidor
Node.js com `ws` em `backend/`, com salas por código e apenas jogadores humanos.
As salas e sessões ficam em memória: reiniciar o servidor encerra todas elas.

## Princípio

**O servidor é a autoridade.** O backend importa diretamente o mesmo motor que o
front usa no modo local, sem reimplementar as regras:

| Arquivo | O que é |
|---|---|
| `frontend/src/game/types.ts` | Tipos: `RoomState`, `Intent`, `GameEvent`. **É o contrato.** |
| `frontend/src/game/engine.ts` | Motor puro: `createRoom`, `applyIntent`, `tick`, `viewFor`, `scoreRound`. |
| `frontend/src/game/rules.ts` | Tempos, pontos, normalização, RNG determinístico. |
| `frontend/src/data/categories.ts` | IDs de categorias e letras sorteáveis. |
| `frontend/src/data/voiceLines.ts` | IDs das falas do Dr. Felipe (o servidor escolhe, o cliente toca). |
| `frontend/src/data/team.ts` | IDs dos personagens (`memberId`). |

O motor não usa `Date.now()` nem `Math.random()`. O tempo entra por parâmetro (`now`)
e o RNG fica em `RoomState.seed`. Mudanças em tipos, intents ou eventos devem manter
o front, o backend e este documento sincronizados.

## Transporte

WebSocket com mensagens JSON no caminho `/ws` (`/` também é aceito por
compatibilidade). O cliente está em `frontend/src/net/socketTransport.ts`. A URL
vem de `VITE_WS_URL` (ex.: `wss://stoplantao.seudominio.com/ws`).

### Cliente → servidor

```ts
{ t: 'create', me: Identity, settings: Partial<RoomSettings> }
{ t: 'join',   me: Identity, code: string } // também é a reconexão
{ t: 'intent', intent: Intent }
{ t: 'ping',   clientNow: number }

type Identity = { playerId: string; memberId: string; name: string; sessionToken?: string }
```

`create` e `join` são as únicas formas de criar ou assumir uma vaga. O servidor
recusa `intent` com `type: 'join'`; esse intent é reservado ao uso interno do motor.
Intents recebidos são vinculados ao jogador autenticado da conexão: o servidor
sobrescreve `intent.playerId`, sem confiar no ID enviado pelo cliente.

### Servidor → cliente

```ts
{ t: 'welcome', playerId: string, sessionToken: string } // antes do 1º state
{ t: 'state',  state: RoomState, serverNow: number }     // SEMPRE viewFor(state, playerId)
{ t: 'events', events: GameEvent[] }
{ t: 'error',  message: string, code?: ErrorCode, fatal?: boolean } // PT-BR, vira toast
{ t: 'pong',   clientNow: number, serverNow: number }

type ErrorCode = 'ROOM_NOT_FOUND' | 'MEMBER_TAKEN' | 'ROOM_FULL' | 'BANNED' | 'BAD_INTENT'
```

- `fatal: true` faz o cliente desistir da sala e voltar à Home. Toda falha de
  `create`/`join`, inclusive na reconexão, é fatal. `ROOM_NOT_FOUND`, `MEMBER_TAKEN`,
  `ROOM_FULL` e `BANNED` também são tratados como fatais pelo cliente.
- Uma recusa de jogo (`rejected` do motor, ex.: "Só o host avança") vira
  `code: 'BAD_INTENT'`, sem `fatal`, apenas para o jogador que enviou o intent.
- `welcome.playerId` preserva o `playerId` solicitado na criação ou entrada aceita.

### Rodada e etapa dos intents

`RoomState.roundSerial` começa em `0` e aumenta a cada rodada iniciada. A rodada
recebe `RoundState.id = ++roundSerial`. Esse contador não volta a zero em `restart`:
o ID identifica uma rodada durante toda a vida da sala, mesmo entre partidas.
`roundIndex` continua sendo o número da rodada exibido na partida atual.

Os intents de uma rodada carregam o ID da rodada em que foram produzidos:

```ts
{ type: 'answer', playerId: string, roundId: number, categoryId: string, value: string }
{ type: 'stop',   playerId: string, roundId: number }
{ type: 'vote',   playerId: string, roundId: number, categoryId: string, targetId: string, valid: boolean }
{ type: 'ready',  playerId: string, roundId: number, categoryId: string }
```

`roundId` é obrigatório nos quatro intents. `vote` e `ready` também identificam a
categoria da etapa de validação. O cliente captura a rodada e a categoria atuais
antes de enfileirar a ação; reconectar não pode trocar esses identificadores pelos
da nova visão. O motor ignora silenciosamente intents de outra rodada ou etapa,
impedindo que uma ação atrasada altere a rodada ou categoria seguinte.

## Sessão (`sessionToken`)

O `playerId` é público (vai no `state` de todo mundo). Ele **não** prova quem é o dono da vaga.

- Ao criar uma vaga, o servidor gera um token aleatório com pelo menos 128 bits,
  guarda `playerId -> token` **fora** do `RoomState` e envia `welcome`.
- `join` com um `playerId` existente é reconexão e exige o token daquela vaga.
  Sem token ou com token errado: `MEMBER_TAKEN`, `fatal: true`.
- Há uma conexão por vaga. Na reconexão aceita, o socket antigo é fechado sem
  aplicar `leave`. O fechamento de um socket substituído não desconecta o novo.
- O cliente guarda o token em `sessionStorage` (`stoplantao:session:<CODE>`) e o
  envia em todo `join` da sala.

## Ciclo da sala

1. `create`: o servidor gera código e seed, chama `createRoom` e responde com
   `welcome` e `state`.
2. `join`: localiza a sala, valida identidade, banimento, token, personagem e
   capacidade, e aplica o `join` interno ao motor sem o `sessionToken`.
   Uma vaga existente volta com `connected = true` e `playerReconnected`.
   Falhas de entrada recebem `error` fatal: sala inexistente `ROOM_NOT_FOUND`,
   personagem ou vaga indisponível `MEMBER_TAKEN`, sala cheia `ROOM_FULL`, jogador
   expulso `BANNED` e payload inválido `BAD_INTENT`.
3. Antes de aplicar cada intent, o servidor roda `tick(state, now)` para cumprir
   os prazos vencidos. Depois chama `applyIntent` com o jogador da conexão e o
   relógio do servidor. Um intent recebido após o prazo não prolonga a fase.
4. Um loop a cada 100 ms também roda `tick`, mesmo sem mensagens dos jogadores.
5. Depois de mudanças, o servidor envia a visão filtrada de cada jogador e os
   eventos públicos para os sockets da sala. `rejected` nunca é retransmitido.
6. Quando o socket atual de uma vaga fecha, o servidor aplica `leave`. No lobby
   há tolerância de 3 segundos para uma reconexão cancelar a saída; fora dele a
   saída é imediata. No lobby o jogador sai da lista. Nas demais fases ele fica
   `connected = false`, perde o host e deixa de travar a validação.
7. `kick` gera `kicked` e `playerLeft`, e inclui o ID em `state.banned`. O servidor
   envia os eventos antes de fechar o socket expulso. Nova entrada desse jogador
   recebe `BANNED`, `fatal: true`.
8. Salas sem conexões expiram após 30 minutos por padrão. Não há persistência nem
   lista de salas públicas.

## Reconexão

- Depois de entrar na sala, uma queda mostra "reconectando" e inicia novas
  tentativas após 0,5 s, 1 s, 2 s, 4 s e então a cada 8 s. O contador de tentativas
  só é zerado quando chega um `state`, confirmando a entrada naquela conexão.
- A primeira mensagem de cada conexão é `create` ou `join`. Na reconexão é sempre
  `join` com o `sessionToken`. Os intents ficam retidos até o primeiro `state`
  daquela conexão confirmar a entrada; abrir o socket ou receber `welcome` ainda
  não libera a fila.
- A fila mantém somente a última `answer` por categoria e descarta ações de outra
  rodada ou etapa, conforme a nova visão. `stop`/`ready`/`vote` e
  `start`/`next`/`restart`/`kick` com mais de 3 segundos também são descartados.
  A mesma filtragem vale para ações produzidas durante a reconexão.
- Se a primeira conexão cai antes de qualquer `state`, o cliente desiste; não
  reenvia `create`, para evitar salas duplicadas.
- Cada tentativa tem 10 segundos para receber o primeiro `state`. O cliente
  também fecha conexões sem `pong` JSON há 30 segundos para iniciar a recuperação.
- A última sala fica em `sessionStorage`
  (`stoplantao:lastRoom` = `{ code }`) para voltar após F5.

## Eventos e o que o cliente faz

| Evento | Efeito no cliente |
|---|---|
| `playerJoined` / `playerLeft` | som de entrada/saída (`playerLeft` do próprio jogador é ignorado) |
| `playerReconnected` | som de entrada (vaga existente voltou) |
| `kicked { playerId }` | se for eu: toast "Você foi removido da sala" e volta para a Home |
| `drawing` | roleta da letra |
| `roundStarted` | som de largada, libera os campos |
| `stopCalled { playerId, voiceLineId }` | explosão STOP!, sirene, voz do Dr. Felipe |
| `timeUp { voiceLineId }` | linha reta (flatline), voz do Dr. Felipe |
| `validationStep` | troca de categoria na votação |
| `roundScored { summary }` | placar da rodada |
| `gameOver { ranking, places }` | pódio, fanfarra, confete. `places[id]` = colocação com empate (1, 1, 3); ordem por pontos e depois ordem de entrada |
| `backToLobby` | volta ao lobby |
| `rejected { reason }` | enviado só ao autor como `error` |

A fala do Dr. Felipe é escolhida pelo **servidor** (`voiceLineId`). Assim todos ouvem a mesma.

## Tempo

`phaseEndsAt` é epoch em ms no relógio do servidor. Todo `state` inclui `serverNow`.
O cliente usa `serverNow` só até o primeiro `pong`; depois usa o offset do `pong`
de menor RTT entre os 5 últimos (ping a cada 10 s). O servidor responde `ping`
imediatamente, sem esperar o loop do jogo.

STOP/tempo esgotado: `round.stoppedAt = now`. Durante `stopped`, o motor ainda
aceita `answer` da mesma rodada por `TIMINGS.answerGraceMs` (1200 ms) depois de
`stoppedAt`, para respostas que estavam a caminho. Depois dessa tolerância, a
resposta atrasada é ignorada. O servidor aplica os prazos antes de cada intent.

## Privacidade

**Nunca envie o estado cru.** O servidor sempre usa `viewFor(state, playerId)`, que:

- zera `seed`, `voiceBag` e `banned` (com o `seed` seria possível prever as próximas letras);
- esconde as respostas dos outros durante `answering` e `stopped`, incluindo a janela de tolerância.

Na validação, respostas e votos ficam visíveis para todos. O `sessionToken` nunca
entra no `RoomState` nem na visão dos outros jogadores.

## Votação

`round.voters[categoryId]` é a lista dos jogadores conectados no início daquela
etapa. Esse snapshot não muda até o fim da etapa: quem entra depois não ganha
direito de voto nela, e os votos já dados por quem se desconecta continuam contando.
Voto ausente conta como válido. Desconectados não bloqueiam o avanço da validação.

`vote` e `ready` precisam corresponder ao `round.id` e à categoria em validação.
Respostas iguais após normalização compartilham o veredito, sem voto em si mesmo.

## Validações e limites

- Só o host pode `start`, `updateSettings`, `kick`, `next` e `restart`.
- `stop` exige todas as categorias preenchidas com a letra sorteada.
- `vote` só vale na categoria atual e em resposta votável; não permite votar em si mesmo.
- Respostas são cortadas em 40 caracteres e configurações passam por `sanitizeSettings`.
- Jogadores expulsos não voltam. Quem não está conectado não pode agir na sala.
- JSON inválido, payloads com tipos incorretos e intents desconhecidos são
  tratados sem derrubar o processo. O transporte limita cada conexão a 30
  mensagens por segundo e cada mensagem a 4 KB (4096 bytes).
- Exceder a taxa envia erro fatal e fecha com código `4008`; mensagem grande
  demais fecha com `1009`. Clientes com mais de 1 MB pendente de envio são
  desconectados. Cada sala conserva no máximo 512 sessões distintas ao longo
  de sua vida, incluindo vagas que saíram; novas identidades além disso recebem
  `ROOM_FULL`, e sessões existentes ainda podem reconectar.
- O servidor usa ping/pong do próprio WebSocket a cada 30 segundos para detectar
  conexões que deixaram de responder, além do ping JSON usado pelo relógio do jogo.
- Não há bots no servidor; `BotBrain` continua restrito ao modo treino local.

## Executar

O backend requer Node.js 22 ou superior:

```bash
cd backend
npm install
npm run dev
```

Para testes e build de produção (o build inclui typecheck):

```bash
cd backend
npm test
npm run build
npm start
```

O servidor responde a `GET /health` com `{ "ok": true }` e aceita estas variáveis:

| Variável | Padrão | Efeito |
|---|---|---|
| `HOST` | `0.0.0.0` | Endereço em que o processo escuta. |
| `PORT` | `8787` | Porta HTTP e WebSocket. |
| `ALLOWED_ORIGINS` | ausente | Origens permitidas, separadas por vírgulas. Ausente aceita qualquer origem; em produção, configure a origem do front. |
| `ROOM_TTL_MS` | `1800000` | Tempo sem conexões até a sala expirar (30 minutos). |
| `LOBBY_GRACE_MS` | `3000` | Tolerância para reconexão no lobby. |
| `MAX_ROOMS` | `1000` | Limite de salas simultâneas. |
| `MAX_CONNECTIONS` | `1000` | Limite de conexões WebSocket simultâneas. |

Em outro terminal, rode o front contra o servidor:

```bash
cd frontend
VITE_WS_URL=ws://localhost:8787/ws npm run dev
```

Com `VITE_WS_URL` definida, "Entrar com código" funciona e "Criar sala" ganha a
opção "Sala online". A hospedagem de produção precisa manter um processo Node.js
e conexões WebSocket de longa duração. Cada instância mantém seu próprio conjunto
de salas em memória.
