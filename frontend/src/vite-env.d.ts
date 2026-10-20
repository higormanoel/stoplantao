/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL do servidor WebSocket (ex.: wss://stoplantao.ifh.com.br/ws). Sem ela o jogo roda só no modo treino local. */
  readonly VITE_WS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
