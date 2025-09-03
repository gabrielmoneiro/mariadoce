import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/firebase/firebaseAdmin";

interface WebhookResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WebhookResponse>
) {
  // Verificar se é uma requisição POST
  if (req.method !== "POST") {
    return res.status(405).json({ 
      success: false, 
      message: "Método não permitido",
      error: `O método ${req.method} não é suportado para este endpoint`
    });
  }

  try {
    // Verificar token de segurança (importante para proteger seu webhook)
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.WEBHOOK_SECRET_TOKEN;
    
    if (!expectedToken) {
      console.warn("WEBHOOK_SECRET_TOKEN não está configurado nas variáveis de ambiente");
    }
    
    if (expectedToken && (!authHeader || authHeader !== `Bearer ${expectedToken}`)) {
      return res.status(401).json({ 
        success: false, 
        message: "Não autorizado",
        error: "Token de autenticação inválido ou ausente" 
      });
    }

    // Processar os dados recebidos do webhook
    const webhookData = req.body;
    console.log("Webhook recebido:", JSON.stringify(webhookData, null, 2));

    // Validar dados recebidos
    if (!webhookData) {
      return res.status(400).json({ 
        success: false, 
        message: "Dados inválidos",
        error: "O corpo da requisição está vazio ou mal formatado" 
      });
    }

    // Exemplo: Atualizar status de um pedido
    if (webhookData.pedidoId && webhookData.novoStatus) {
      try {
        await db.collection("pedidos").doc(webhookData.pedidoId).update({
          statusPedido: webhookData.novoStatus,
          atualizadoEm: new Date(),
          atualizadoPor: "webhook"
        });
        
        console.log(`Pedido ${webhookData.pedidoId} atualizado para status: ${webhookData.novoStatus}`);
      } catch (dbError) {
        console.error("Erro ao atualizar pedido no Firestore:", dbError);
        return res.status(500).json({ 
          success: false, 
          message: "Erro ao atualizar pedido",
          error: "Falha ao atualizar o documento no Firestore" 
        });
      }
    }

    // Exemplo: Registrar mensagem do WhatsApp
    if (webhookData.tipo === "mensagem_whatsapp" && webhookData.telefone) {
      try {
        await db.collection("mensagens").add({
          telefone: webhookData.telefone,
          mensagem: webhookData.mensagem || "",
          dataMensagem: new Date(),
          processada: false
        });
        
        console.log(`Mensagem de WhatsApp registrada para: ${webhookData.telefone}`);
      } catch (dbError) {
        console.error("Erro ao registrar mensagem no Firestore:", dbError);
        // Não falhar a requisição por erro no registro de mensagem
      }
    }

    // Responder com sucesso
    return res.status(200).json({ 
      success: true, 
      message: "Webhook processado com sucesso",
      data: { 
        processadoEm: new Date().toISOString(),
        tipoProcessado: webhookData.pedidoId ? "atualizacao_pedido" : 
                        webhookData.tipo === "mensagem_whatsapp" ? "mensagem_whatsapp" : 
                        "outro"
      }
    });
  } catch (error) {
    console.error("Erro ao processar webhook:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Erro ao processar webhook",
      error: error instanceof Error ? error.message : "Erro desconhecido" 
    });
  }
}
