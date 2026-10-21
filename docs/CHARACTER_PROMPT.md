# Como gerar personagens no estilo do Stoplantão

O avatar do Higor serve como referência de direção de arte: contorno preto grosso,
formas geométricas, cabeça grande, olhos simples e sombras recortadas. A receita
abaixo deriva do bloco de estilo usado no elenco, com a orientação de manter o
nariz proporcional à pessoa, como na versão final aprovada do Higor.

![Avatar do Higor, referência de estilo](../frontend/public/assets/avatars/higor-512.webp)

## Duas referências com funções diferentes

1. **Imagem 1 — estilo:** use o [avatar público do Higor](../frontend/public/assets/avatars/higor-512.webp)
   ou outro avatar aprovado do elenco. Ela orienta o traço, a simplificação e as cores.
2. **Imagem 2 — semelhança:** use uma foto nítida da pessoa, com o rosto visível.
   Ela orienta os traços do rosto, o cabelo, o tom de pele e os acessórios.

A foto pode ser fornecida à ferramenta durante a geração, mas permanece fora do
repositório público. Não publique fotos de referência, identificadores de upload
ou arquivos da conta de geração. A imagem de estilo não deve transferir o rosto
do Higor para os outros personagens.

No elenco original, a geração usou GPT Image 2.5 no Higgsfield, em qualidade alta,
formato 1:1, resolução de aproximadamente 1k e fundo transparente. O Higor recebeu
um ajuste posterior localizado no nariz. O prompt pode ser adaptado a outras
ferramentas que aceitem referências; selecione também a opção de transparência da
ferramenta, quando disponível.

## Prompt principal

Anexe as imagens na ordem acima e substitua os três campos entre colchetes.
Mantenha o bloco de estilo igual entre os personagens; mude a aparência, a pose e
o figurino conforme a pessoa.

```text
Create an original cartoon game avatar of the person in Image 2, matching the
visual language of the approved game avatar in Image 1.

REFERENCE ROLES:
Image 1 is the ART STYLE reference only: match its line weight, geometric shape
language, simplified facial features, flat palette and hard-edged cel shadows.
Image 2 is the IDENTITY reference: preserve this person's recognizable face,
hairline, hairstyle, skin tone, facial hair and distinctive accessories. Ignore
the photo's background, text, logos, lighting effects and interface elements.
Do not copy the identity, clothing or pose from Image 1 unless requested below.

ART STYLE (strict):
Bold indie-game character design, like a modern flash/mobile party-game cast.
Extra-thick solid black ink outlines of heavy, consistent weight, slightly
hand-inked. Simplified blocky geometric construction: a large rounded-rectangle
or bean-shaped head, an oversized head relative to the bust, clear angular facial
planes, and a strong readable silhouette. Small simple eyes with solid black
pupils, no anime eyes and no glossy eye highlights. Thick chunky eyebrows that
still follow the person's actual shape. Minimal facial lines.
Flat solid colors with ONE hard-edged cel shadow shape per color region.
Hair and beard built from a few chunky solid shapes and a few inner ink strokes;
tiny sparse dots may suggest stubble. Humorous, charismatic and expressive,
with the same graphic simplicity as Image 1.

LIKENESS:
[APPEARANCE: describe the person's face shape, hair, facial hair, skin tone,
glasses and expression, based on Image 2.]
Keep the person's nose recognizable and proportional to the reference photo.
Stylize it using a few simple shapes; do not enlarge, lengthen, sharpen or
beautify it. Preserve the person's age and distinctive facial characteristics.

POSE AND EXPRESSION:
[POSE: describe the head angle, gaze, expression and any hand gesture.]
If hands are visible, use coherent anatomy: five fingers per hand, natural
joints, no extra fingers, no fused hands and no duplicated accessories.

OUTFIT AND ACCESSORIES:
[OUTFIT_AND_ACCESSORIES: describe only the intended clothes and accessories.]

FRAMING AND OUTPUT:
Square 1:1 canvas, centered bust portrait, head and shoulders large in frame.
Keep the entire hairstyle and all important hand gestures inside the canvas.
Crop the lower torso at the bottom edge, with no empty strip below the bust.
Fully transparent background with real alpha transparency and clean cutout
edges. The avatar will be placed inside a circle by the game's interface:
do not draw a circle, badge, border, pedestal or background yourself.

AVOID:
Photorealism, 3D rendering, plastic or glossy surfaces, gradients, airbrushing,
soft shadows, rim light, bloom, detailed skin texture, realistic strands of hair,
watercolor, an oval shiny highlight on the nose, exaggerated nose proportions,
extra objects, text, logos, signatures, watermarks, a checkerboard pattern,
colored backgrounds and opaque black or white backgrounds.
```

## Exemplo: Higor na pose pensativa

Use o prompt principal com o avatar aprovado como Imagem 1 e uma foto privada do
Higor como Imagem 2. Substitua os campos por estes trechos:

```text
APPEARANCE:
Higor, an adult man with light skin, short dark brown hair with shorter sides
and a textured, slightly side-swept top, dark rectangular glasses, thick dark
eyebrows, a short full dark beard and mustache. Thoughtful, focused expression,
closed mouth. Preserve the face and the actual nose proportions from Image 2.

POSE:
Slight three-quarter turn, looking forward and a little to the side. One hand
rests naturally on the chin in a thinking pose, with the fingers following the
jaw and the thumb supporting the chin. Match the composition of the approved
Higor avatar; keep the hand, wrist and watch legible.

OUTFIT_AND_ACCESSORIES:
Black collared button-up shirt with rolled-up sleeves, black rectangular
smartwatch on the raised wrist, dark rectangular glasses and one small white
wireless earbud in the visible ear. No additional props or accessories.
```

Para recuperar **a mesma composição do Higor**, use o próprio avatar como alvo de
edição. Gerar novamente apenas a partir do texto pode mudar o rosto, o gesto ou a
espessura do traço.

## Ajuste localizado: somente o nariz

Anexe o avatar a editar como Imagem 1 e a foto da pessoa como Imagem 2. Se a
ferramenta oferecer máscara de edição, delimite apenas a região do nariz.

```text
Edit Image 1. Change ONLY the nose so that its size, bridge, tip and nostril
shape are closer to the same person's nose in Image 2. Image 2 is an identity
reference only; do not transfer its photographic rendering or lighting.

Use the exact existing cartoon language: thick black outline, simple geometric
planes, flat skin colors and a single hard-edged shadow. Keep the nose natural
and proportional; do not exaggerate it and do not add an oval glossy highlight.

Preserve everything else from Image 1: identity, face shape, eyes, eyebrows,
glasses, hair, beard, expression, mouth, pose, hands, clothing, watch, earbud,
line weight, colors, framing and canvas dimensions. Do not redraw or restyle
the rest of the avatar. Preserve real background transparency and clean alpha
edges. No background, circle, text, logo or watermark.
```

## Seleção e exportação

Compare o resultado com o avatar de estilo e com a foto: o traço deve pertencer ao
mesmo elenco, e o rosto deve continuar reconhecível. Confira especialmente o
nariz, os óculos e as mãos. Veja a imagem sobre superfícies claras e escuras para
detectar fundo opaco, bordas claras ou transparência simulada por um xadrez.

A geração por IA não garante uma reprodução idêntica em todas as tentativas.
Escolha uma versão aprovada e faça correções localizadas, uma de cada vez, para
reduzir mudanças indesejadas no desenho inteiro.

Guarde o PNG aprovado com transparência no acervo local. Gere duas versões WebP
quadradas, de **512 × 512** e **256 × 256**, preservando o canal alpha. No projeto,
os arquivos seguem o padrão `frontend/public/assets/avatars/<id>-512.webp` e
`<id>-256.webp`. O círculo e o recorte pertencem à interface, não à imagem.

Exemplo de exportação com Pillow, com a mesma qualidade usada nos avatares do jogo:

```python
from pathlib import Path
from PIL import Image

personagem_id = "novo-id"  # Para substituir um avatar, use o ID já existente.
source = Path("avatar-aprovado.png")
destination = Path("frontend/public/assets/avatars")
destination.mkdir(parents=True, exist_ok=True)

with Image.open(source) as original:
    avatar = original.convert("RGBA")
    if avatar.width != avatar.height:
        raise ValueError("Aprove um avatar quadrado antes de exportar.")
    if avatar.getchannel("A").getextrema()[0] == 255:
        raise ValueError("O arquivo precisa ter transparência real.")
    for size in (512, 256):
        avatar.resize((size, size), Image.Resampling.LANCZOS).save(
            destination / f"{personagem_id}-{size}.webp",
            "WEBP",
            quality=88,
            method=6,
        )
```

Ao substituir um personagem, mantenha os IDs e os nomes de arquivo existentes:
eles são usados pelo jogo e pelo servidor. Publique os avatares finais aprovados;
as fotos e os arquivos brutos de produção continuam locais.
