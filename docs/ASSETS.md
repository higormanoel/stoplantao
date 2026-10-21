# Assets — como foram feitos e como refazer

O que o jogo usa fica em `frontend/public/assets/` e acompanha o repositório público.
As fontes brutas em `assets-source/` e as fotos em `reference/` pertencem ao acervo
local privado e não são versionadas na publicação. Os caminhos dessas pastas
citados abaixo documentam o processo de produção; não são necessários para rodar
ou compilar o jogo.

## Logo do iFH

- Versão branca e laranja enviada pelo usuário em 20/10/2026, preservada em
  `assets-source/brand/logo-ifh.png`.
- `frontend/public/assets/brand/logo-ifh.webp` usa essa mesma arte, com as margens
  transparentes removidas e largura de 840px, exportada em WebP sem perdas.
  A transparência é preservada. Esse arquivo é compartilhado pela assinatura
  do Stoplantão e pelo rodapé da Home.

## Personagens (avatares)

A receita pública com prompt copiável, exemplo do Higor e ajuste localizado está
em [Como gerar personagens no estilo do Stoplantão](CHARACTER_PROMPT.md).

- Ferramenta: Higgsfield, modelo **GPT Image 2.5**, qualidade `high`, fundo transparente, 1:1, 1k.
- Referência: a foto de cada pessoa em `reference/team/<id>.png`.
  Os IDs das fotos enviadas ao Higgsfield estão em `assets-source/avatars/higgsfield-media-ids.json`.
- Prompt: um bloco de estilo fixo e um bloco de semelhança por pessoa.
  Os prompts completos estão em `assets-source/avatars/batch-1-requests.json`.

Bloco de estilo (igual para todos):

> ART STYLE (strict): bold indie-game character design, like a modern flash/mobile party-game cast.
> Extra-thick solid black ink outlines of heavy consistent weight, slightly hand-inked. Simplified
> blocky geometric construction (...) small simple eyes with solid black pupils (no anime eyes),
> very thick chunky black eyebrows (...) Flat solid colors only with ONE hard-edged cel shadow
> shape per color, no gradients (...) FRAMING: bust (head + shoulders), centered (...)
> BACKGROUND: fully transparent.

- PNG 1024 originais: `assets-source/avatars/raw/`. IDs dos jobs: `assets-source/avatars/batch-1-jobs.json`.
- Higor atualizado em 20/10/2026 com a versão aprovada pelo usuário: PNG de origem
  1254 × 1254 em `raw/higor.png`, editado com a ferramenta integrada `imagegen`.
  Prompt do ajuste: modificar apenas o nariz pelas fotos de referência, mantendo
  o traço geométrico, a expressão, a pose e o fundo transparente; sombreado simples,
  sem brilho oval na ponta. WebP 512/256 exportados com a mesma receita abaixo.
- Exportação para WebP 512/256: `python3 assets-source/avatars/export.py frontend/public/assets/avatars`.
- Poses do Dr. Felipe (`felipe-laugh`, `felipe-point`, `felipe-stop`, `felipe-watch`): mesmo modelo,
  com o avatar do Felipe e a foto dele como referências.

Para trocar um personagem: gere de novo com a mesma receita, salve em `raw/<id>.png` e rode o export.

## Voz do Dr. Felipe

Voz do Dr. Felipe produzida com Higgsfield. Os identificadores da conta e do
modelo de voz ficam apenas no acervo local de produção.

**Versão 2 (atual, tom debochado)** — `assets-source/voice/v2/`
- Texto reescrito para soar sarcástico (pausas, "né?", "hein", vogais esticadas): `v2/script.json`.
- 3 tomadas por fala: Seed Audio 1.0 com velocidade -8 a -14 (A e B) e Qwen Audio 3.0 com direção
  de emoção em português ("Deboche total, ironia exagerada…").
- QA: `assets-source/voice/analyze.py` transcreve com Whisper large-v3-turbo e mede a variação de tom.
  A escolha pesou texto completo primeiro e expressividade depois.
- Página de comparação: `v2/review.html` (rode `python3 -m http.server 5190 --directory assets-source/voice/v2`
  e abra `http://localhost:5190/review.html`). `v2/build_review.py` corta o silêncio e gera a página.
- ElevenLabs v4 foi testado e descartado: o timbre saiu bem mais agudo que o do Dr. Felipe.
- Dica de pronúncia: escreva "IA" como `i-á`. No Qwen, "IA" sai errado mesmo assim; use o Seed nessas falas.

| ID | Tomada | Fala (legenda) |
|---|---|---|
| stop-plantao | Seed B | Ah, tá… dar Stop aqui é fácil, né? Quero ver dar Stop no plantão! |
| stop-ia | Seed A | Tá de IA, hein? Eu tô vendo, viu… Kkkkk |
| stop-japa | Seed A | Uhhh! Stopzinho pericial… pra comer um japa, né?! |
| stop-pericia | Seed A | Hmm… vai dar Perícia, hein! |
| stop-convenio | Seed B | Hmm… esse aí deve ser médico de convênio. Certeza! |
| stop-fernandao | Seed B | Fernandão… desliga a internet dele! |
| nostop-proximo | Qwen | Hahaha! Não foi dessa vez, hein… Desista, porque o próximo Stop será o meu! |
| nostop-dormiu | Qwen | Ihhh, dormiu no ponto, hein! |
| nostop-cade | Seed A | Cadê? Ninguém? |
| nostop-sucesso | Qwen | Sucesso ama execução, viu? Bora executar, né! |
| nostop-ia | Seed A | Ahhh, nem usando IA deu certo? Hahaha |

Para trocar uma fala: copie `v2/review/<id>--<tomada>.m4a` para `frontend/public/assets/voice/<id>.m4a`
e ajuste o texto em `frontend/src/data/voiceLines.ts`.

**Versão 1** (tom neutro) fica em `assets-source/voice/takes/` e `final/`, processada por `process.py`.

## Efeitos sonoros

Sintetizados na hora com Web Audio em `frontend/src/audio/synth.ts`. Não há arquivo de áudio.
Lista: clique, hover, pop, entrada de jogador, roleta da letra, revelação da letra, largada,
tecla, campo certo, erro, bipe de monitor, flatline, sirene de ambulância, batida do STOP,
voto válido/inválido, moedas do placar, rufar de tambor, fanfarra, tique do relógio.

Para trocar por arquivos gravados: mantenha os nomes de `SfxName` e troque a implementação de `playSynth`.

## Banco de palavras dos bots

`frontend/src/data/wordbank.json`: 16 categorias × 22 letras, cerca de 1.300 palavras.
Gerado por agentes de IA e filtrado por código (a palavra precisa começar com a letra).
Os bots usam o banco para responder e para votar. Pode editar à mão.
