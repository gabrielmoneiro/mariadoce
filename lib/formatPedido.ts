import { CartItem } from '@/context/CartContext';

export const formatPedidoWhatsApp = (
  cartItems: any[],
  nomeCliente: string,
  enderecoCliente: string, // Mudado de bairroCliente para enderecoCliente
  total: number,
  telefone: string,
  formaPagamento: string,
  trocoPara?: string,
  observacoes?: string,
  deliveryFee: number = 0
): string => {
  let mensagem = `*Novo Pedido Recebido*

*Cliente:* ${nomeCliente}
*Telefone:* ${telefone}
*Endereço:* ${enderecoCliente}

*Itens:*
`;

  cartItems.forEach(item => {
    const itemName = item.name;
    const itemPrice = item.price;
    const itemQuantity = item.quantity;
    const itemTotal = itemPrice * itemQuantity;
    
    let itemDetails = `- ${itemQuantity}x ${itemName} (R$ ${itemPrice.toFixed(2)} c/u) = R$ ${itemTotal.toFixed(2)}`;
    
    // Adicionar tamanho selecionado, se disponível
    if (item.tamanhoSelecionado) {
      itemDetails += `\n   Tamanho: ${item.tamanhoSelecionado}`;
    }
    
    // Adicionar adicionais selecionados, se disponíveis
    if (item.adicionaisSelecionados) {
      itemDetails += `\n   Adicionais: ${item.adicionaisSelecionados}`;
    }
    
    mensagem += `${itemDetails}\n`;
  });

  // Subtotal dos produtos
  const subtotal = total - deliveryFee;
  
  mensagem += `
*Subtotal dos Produtos:* R$ ${subtotal.toFixed(2)}`;

  // Destacar o valor do frete separadamente apenas se houver
  if (deliveryFee > 0) {
    mensagem += `
*Taxa de Entrega:* R$ ${deliveryFee.toFixed(2)}`;
  }

  // Total geral
  mensagem += `
*Total do Pedido:* R$ ${total.toFixed(2)}`;

  // Forma de pagamento
  mensagem += `

*Forma de Pagamento:* ${formaPagamento}`;

  // Adicionar informação de troco, se aplicável
  if (formaPagamento.includes("Dinheiro") && trocoPara) {
    mensagem += `
*Troco para:* R$ ${trocoPara}`;
  }

  // Adicionar observações, se houver
  if (observacoes && observacoes.trim() !== '') {
    mensagem += `

*Observações:*
${observacoes}`;
  }

  mensagem += `

---
Pedido gerado via site.`;

  return mensagem;
};
