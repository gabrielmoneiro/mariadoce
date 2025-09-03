import { db, auth } from "@/lib/firebase/firebaseAdmin";
import type { NextApiRequest, NextApiResponse } from "next";
import { Timestamp } from "firebase-admin/firestore";
import { PedidoDataSchema, PedidoDataInput } from "@/lib/schemas/pedidoSchema";
import { ZodError } from "zod";

// Tipagem para os dados do produto recuperados do Firestore
interface ProdutoFirestore {
  nome: string;
  preco: number;
  // adicionar outros campos relevantes se necessário (ex: stock)
}

// Tipagem para a seleção de agendamento (copiada de scheduleTypes.ts para clareza)
interface ScheduleSelection {
  date: string; // Formato "YYYY-MM-DD"
  timeWindow: string; // Formato "HH:MM-HH:MM"
}

// Tipagem para o pedido a ser salvo no Firestore (incluindo dados calculados no servidor)
interface PedidoParaSalvar extends Omit<PedidoDataInput, 'valores' | 'itensPedido' | 'scheduleSelection'> {
  uidCliente?: string;
  itensPedido: Array<Omit<PedidoDataInput['itensPedido'][number], 'subtotal' | 'precoUnitario'> & { precoUnitarioReal: number; subtotalReal: number }>;
  valores: {
    subtotalItensReal: number;
    taxaEntrega: number;
    totalPedidoReal: number;
    descontos?: number;
  };
  dataPedido: Timestamp;
  statusPedido: string;
  origemPedido: string;
  scheduleSelection?: ScheduleSelection | null; // Adicionar campo de agendamento
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // 1. Verificar Autenticação (Firebase Token)
  const { authorization } = req.headers;
  let uidCliente: string | undefined = undefined;

  if (!authorization?.startsWith("Bearer ")) {
    console.warn("Pedido recebido sem token de autenticação.");
  } else {
      const idToken = authorization.split("Bearer ")[1];
      try {
        const decodedToken = await auth.verifyIdToken(idToken);
        uidCliente = decodedToken.uid;
        console.log(`Pedido autenticado para UID: ${uidCliente}`);
      } catch (error) {
        console.error("Erro ao verificar token:", error);
        return res.status(401).json({ error: "Não autorizado: Token inválido." });
      }
  }

  try {
    // 2. Validar Corpo da Requisição com Zod (agora inclui scheduleSelection)
    const pedidoDataRecebida = PedidoDataSchema.parse(req.body);

    // 3. Validação Adicional e Recálculo de Valores (CRÍTICO)
    let subtotalItensReal = 0;
    const itensPedidoParaSalvar = [];

    for (const item of pedidoDataRecebida.itensPedido) {
      const produtoRef = db.collection("products").doc(item.idProduto);
      const produtoSnap = await produtoRef.get();

      if (!produtoSnap.exists) {
        return res.status(400).json({ error: `Produto com ID ${item.idProduto} não encontrado.` });
      }

      const produtoData = produtoSnap.data() as ProdutoFirestore;
      const precoUnitarioReal = produtoData.preco;
      const subtotalReal = precoUnitarioReal * item.quantidade;

      subtotalItensReal += subtotalReal;

      itensPedidoParaSalvar.push({
        ...item,
        precoUnitarioReal: precoUnitarioReal,
        subtotalReal: subtotalReal,
      });
    }

    const taxaEntregaValidada = pedidoDataRecebida.valores.taxaEntrega >= 0 ? pedidoDataRecebida.valores.taxaEntrega : 0;
    const totalPedidoReal = subtotalItensReal + taxaEntregaValidada - (pedidoDataRecebida.valores.descontos || 0);

    // Validar Forma de Pagamento
    const formasPagamentoPermitidas = ["Dinheiro", "Cartão de Crédito", "Cartão de Débito", "Pix"];
    if (!formasPagamentoPermitidas.includes(pedidoDataRecebida.formaPagamento)) {
        return res.status(400).json({ error: `Forma de pagamento '${pedidoDataRecebida.formaPagamento}' inválida.` });
    }
    if (pedidoDataRecebida.formaPagamento === "Dinheiro" && pedidoDataRecebida.trocoPara) {
        const trocoNum = parseFloat(pedidoDataRecebida.trocoPara);
        if (isNaN(trocoNum) || trocoNum < totalPedidoReal) {
            return res.status(400).json({ error: "Valor do troco inválido." });
        }
    }

    // 4. Montar Objeto Final para Salvar
    const pedidoParaSalvar: PedidoParaSalvar = {
      cliente: pedidoDataRecebida.cliente,
      enderecoEntrega: pedidoDataRecebida.enderecoEntrega,
      itensPedido: itensPedidoParaSalvar,
      formaPagamento: pedidoDataRecebida.formaPagamento,
      trocoPara: pedidoDataRecebida.trocoPara,
      observacoesGerais: pedidoDataRecebida.observacoesGerais,
      uidCliente: uidCliente,
      valores: {
        subtotalItensReal: subtotalItensReal,
        taxaEntrega: taxaEntregaValidada,
        totalPedidoReal: totalPedidoReal,
        descontos: pedidoDataRecebida.valores.descontos,
      },
      // Usar status 'Agendado' se houver seleção de agendamento, senão 'Recebido'
      statusPedido: pedidoDataRecebida.scheduleSelection ? "Agendado" : (pedidoDataRecebida.statusPedido || "Recebido"),
      dataPedido: Timestamp.now(),
      origemPedido: pedidoDataRecebida.origemPedido || "WebApp",
      scheduleSelection: pedidoDataRecebida.scheduleSelection, // Incluir dados de agendamento
    };

    // 5. Salvar no Firestore
    const pedidoRef = await db.collection("pedidos").add(pedidoParaSalvar);

    // 6. Disparar Webhook (se configurado)
    const webhookUrl = process.env.N8N_WEBHOOK_URL_PEDIDO;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idPedidoFirestore: pedidoRef.id, ...pedidoParaSalvar }),
        });
        console.log("Webhook de novo pedido disparado com sucesso para:", webhookUrl);
      } catch (webhookError) {
        console.error("Erro ao disparar webhook de novo pedido:", webhookError);
      }
    }

    // 7. Responder ao Cliente
    res.status(201).json({
      message: "Pedido registrado com sucesso!",
      pedidoId: pedidoRef.id,
      data: pedidoParaSalvar
    });

  } catch (error) {
    if (error instanceof ZodError) {
      console.error("Erro de validação Zod:", error.errors);
      return res.status(400).json({ error: "Dados do pedido inválidos.", details: error.flatten().fieldErrors });
    } else {
      console.error("Erro ao registrar pedido:", error);
      return res.status(500).json({ error: "Falha ao registrar o pedido.", details: error instanceof Error ? error.message : "Erro desconhecido" });
    }
  }
}

