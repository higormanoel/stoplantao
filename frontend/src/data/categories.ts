export interface Category {
  id: string
  label: string
  hint: string
  /** categorias com tema médico/iFH ganham um selo no UI */
  medical?: boolean
}

export const CATEGORIES: Category[] = [
  { id: 'nome', label: 'Nome', hint: 'Nome de pessoa' },
  { id: 'animal', label: 'Animal', hint: 'Qualquer bicho' },
  { id: 'cep', label: 'CEP', hint: 'Cidade, estado ou país' },
  { id: 'cor', label: 'Cor', hint: 'Cores e tons' },
  { id: 'fruta', label: 'FLV', hint: 'Fruta, legume ou verdura' },
  { id: 'objeto', label: 'Objeto', hint: 'Coisa do dia a dia' },
  { id: 'marca', label: 'Marca', hint: 'Empresa ou produto' },
  { id: 'comida', label: 'Comida', hint: 'Prato, doce, lanche' },
  { id: 'profissao', label: 'Profissão', hint: 'Ocupação' },
  { id: 'filme', label: 'Filme ou Série', hint: 'Título conhecido' },
  { id: 'mse', label: 'MSÉ', hint: 'Minha sogra é...' },
  { id: 'corpo', label: 'Parte do Corpo', hint: 'Anatomia', medical: true },
  { id: 'doenca', label: 'Doença', hint: 'Doença ou condição', medical: true },
  { id: 'remedio', label: 'Remédio', hint: 'Medicamento', medical: true },
  { id: 'especialidade', label: 'Especialidade Médica', hint: 'Área da medicina', medical: true },
  { id: 'plantao', label: 'Coisa de Plantão', hint: 'O que tem no plantão?', medical: true },
]

export const CATEGORY_BY_ID: Record<string, Category> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]))

export const DEFAULT_CATEGORY_IDS = ['nome', 'animal', 'cep', 'fruta', 'objeto', 'marca', 'corpo', 'doenca', 'remedio', 'plantao']

/** Letras usadas no sorteio (sem K, W, X, Y). */
export const LETTERS = 'A B C D E F G H I J L M N O P Q R S T U V Z'.split(' ')
