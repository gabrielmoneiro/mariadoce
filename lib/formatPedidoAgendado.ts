import { formatPedidoWhatsApp as originalFormatPedido } from '@/lib/formatPedido';
import { ScheduleSelection } from '@/lib/scheduleTypes';

export const formatPedidoWhatsApp = (
  cartItems: any[],
  nome: string,
  endereco: string,
  totalPedido: number,
  telefone: string,
  formaPagamento: string,
  trocoPara?: string,
  observacoes?: string,
  deliveryFee: number = 0,
  scheduleSelection?: ScheduleSelection | null,
  tipoPedido?: string
) => {
  // Usar a função original para formatar a maior parte do pedido
  let mensagem = originalFormatPedido(
    cartItems,
    nome,
    endereco,
    totalPedido,
    telefone,
    formaPagamento,
    trocoPara,
    observacoes,
    deliveryFee
  );
  
  // Adaptar a mensagem baseada no tipo de pedido
  if (tipoPedido === 'retirada') {
    // Substituir "ENTREGA" por "RETIRADA" na mensagem
    mensagem = mensagem.replace(/ENTREGA/g, 'RETIRADA');
    mensagem = mensagem.replace(/entrega/g, 'retirada');
    mensagem = mensagem.replace(/Endereço de entrega/g, 'Tipo de pedido');
    mensagem = mensagem.replace(/Taxa de entrega/g, 'Taxa de retirada');
  }
  
  // Adicionar informações de agendamento, se disponíveis
  if (scheduleSelection && scheduleSelection.date && scheduleSelection.timeWindow) {
    const data = new Date(scheduleSelection.date).toLocaleDateString('pt-BR');
    const horario = scheduleSelection.timeWindow.replace('-', ' - ');
    
    const tipoAgendamento = tipoPedido === 'retirada' ? 'RETIRADA AGENDADA' : 'ENTREGA AGENDADA';
    
    // Encontrar a posição após o nome do cliente para inserir a informação de agendamento
    const indexAposNome = mensagem.indexOf('\n\n');
    if (indexAposNome !== -1) {
      const parteInicial = mensagem.substring(0, indexAposNome + 2);
      const parteFinal = mensagem.substring(indexAposNome + 2);
      
      mensagem = `${parteInicial}📅 *${tipoAgendamento}* para ${data}, entre ${horario}\n\n${parteFinal}`;
    } else {
      // Fallback caso não encontre a posição ideal
      mensagem += `\n\n📅 *${tipoAgendamento}* para ${data}, entre ${horario}`;
    }
  }
  
  return mensagem;
};
