# Identidade visual — Stoplantão

## Nome

**STOPLANTÃO** = Stop + Plantão. O nome vem da fala do Dr. Felipe:
"Dar Stop aqui é fácil, quero ver dar Stop no plantão!". Junta o jogo
(Stop/adedonha) com a rotina do público do iFH (médico de plantão).

Assinatura: "o stop do time iFH".

## Logo

- Wordmark em Montserrat Black. "STOP" em laranja iFH (degradê `#FF6A2B` → `#FF3D00`)
  e "LANTÃO" em branco.
- Contorno grosso preto (`#0A0A0A`) e extrusão 3D de 9 px para baixo.
- Linha de eletrocardiograma passa por cima da palavra e termina num ponto laranja.
  A linha é desenhada na entrada (animação).
- Componente: `frontend/src/components/Logo.tsx`.

## Cores

A ID do iFH é **laranja + preto**. Não usar azul-marinho nem roxo na interface.

| Uso | Cor |
|---|---|
| Laranja iFH (primária, botões, STOP) | `#FF4200` |
| Laranja destaque (títulos) | `#FF6A2B` / `#FF4E2D` |
| Fundo | `#060606` |
| Moldura / painéis | `#151515`, `#1D1D1D`, `#101010`, `#222222` |
| Bordas | `#2B2B2B`, `#3A3A3A` |
| Contorno "ink" | `#0A0A0A` |
| Texto secundário | `#B8B8B8`, `#8C8C8C` |
| Válido | `#3DDC97` |
| Inválido | `#FF3B5C` (fundo com texto branco: `#D7193A`) |
| Repetido / pontos | `#FFC93C` |

As cores dos círculos dos avatares variam por pessoa (só para diferenciar jogadores).

Tokens em `frontend/src/styles/tokens.css`.

## Tipografia

Montserrat variável (fonte usada nas peças do iFH), arquivo local em
`frontend/public/assets/fonts/montserrat-variable.woff2` (licença OFL).
Títulos em 900 e caixa alta com contorno. Texto em 600.

## Elementos do jogo

- **Placa de PARE:** a letra da rodada fica num octógono laranja. O botão STOP também é octogonal.
- **Monitor cardíaco:** o timer é uma linha de ECG. Nos 10 s finais toca o bipe de monitor e acelera.
  Se ninguém der STOP, a tela mostra a linha reta (flatline).
- **Losangos do iFH:** flutuam no fundo, junto com letras.
- **Botões:** grossos, levemente inclinados, com sombra sólida (estilo game).

## Personagens

16 colaboradores desenhados por IA a partir das fotos reais. Estilo: cartum de
"indie game", contorno preto grosso, formas blocadas, cores chapadas com uma sombra dura.
Dr. Felipe tem 4 poses extras para narrar: rindo, apontando, mão de STOP, olhando o relógio.
