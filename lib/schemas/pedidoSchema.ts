import { z } from 'zod';

// Schema para um item individual no pedido
const ItemPedidoSchema = z.object({
  idProduto: z.string().min(1, { message: "ID do produto é obrigatório." }),
  nomeProduto: z.string().min(1, { message: "Nome do produto é obrigatório." }),
  quantidade: z.number().int().positive({ message: "Quantidade deve ser um número inteiro positivo." }),
  precoUnitario: z.number().positive({ message: "Preço unitário deve ser positivo." }), // Será validado/substituído pelo preço do servidor
  subtotal: z.number().positive({ message: "Subtotal do item deve ser positivo." }), // Será recalculado no servidor
  tamanho: z.string().optional(),
  adicionais: z.string().optional(),
  observacoesItem: z.string().optional(),
});

// Schema para o endereço de entrega
const EnderecoEntregaSchema = z.object({
  fullAddress: z.string().min(1, { message: "Endereço completo é obrigatório." }),
  lat: z.number().optional(),
  lng: z.number().optional(),
  cep: z.string().optional(), // Pode adicionar validação de formato CEP se necessário
  numero: z.string().optional(),
  complemento: z.string().optional(),
  referencia: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
});

// Schema para a seleção de agendamento (opcional)
const ScheduleSelectionSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Formato da data de agendamento inválido (YYYY-MM-DD)." }),
    timeWindow: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/, { message: "Formato da janela de tempo inválido (HH:MM-HH:MM)." }),
}).optional().nullable(); // Tornar opcional e permitir nulo

// Schema principal para os dados do pedido recebidos no corpo da requisição
export const PedidoDataSchema = z.object({
  cliente: z.object({
    nome: z.string().min(1, { message: "Nome do cliente é obrigatório." }),
    telefone: z.string().min(10, { message: "Telefone do cliente inválido." }), // Adicionar regex mais específico se necessário
  }),
  enderecoEntrega: EnderecoEntregaSchema,
  itensPedido: z.array(ItemPedidoSchema).min(1, { message: "O pedido deve conter pelo menos um item." }),
  formaPagamento: z.string().min(1, { message: "Forma de pagamento é obrigatória." }), // Validar contra lista de formas permitidas
  trocoPara: z.string().optional(), // Validar se é número se formaPagamento for Dinheiro
  observacoesGerais: z.string().optional(),
  valores: z.object({ // Estes valores serão recalculados/validados no servidor
    subtotalItens: z.number(),
    taxaEntrega: z.number().nonnegative({ message: "Taxa de entrega não pode ser negativa." }),
    totalPedido: z.number(),
    descontos: z.number().optional(),
  }),
  statusPedido: z.string().optional(), // Será definido como "Recebido" por padrão
  origemPedido: z.string().optional(), // Será definido como "WebApp" por padrão
  scheduleSelection: ScheduleSelectionSchema, // Adicionar campo de agendamento
});

// Tipo inferido do schema para uso no código
export type PedidoDataInput = z.infer<typeof PedidoDataSchema>;

