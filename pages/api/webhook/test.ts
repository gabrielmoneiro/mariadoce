import type { NextApiRequest, NextApiResponse } from "next";

interface TestResponse {
  success: boolean;
  message: string;
  error?: string;
  result?: any;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TestResponse>
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
    const { webhookId, url, secret } = req.body;

    // Validar parâmetros
    if (!webhookId || !url) {
      return res.status(400).json({ 
        success: false, 
        message: "Parâmetros inválidos",
        error: "webhookId e url são obrigatórios" 
      });
    }

    // Preparar payload de teste
    const testPayload = {
      event: "webhook.test",
      timestamp: new Date().toISOString(),
      data: {
        webhookId,
        message: "Este é um teste de webhook enviado do painel administrativo",
        source: "admin_panel"
      }
    };

    // Configurar headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Adicionar token de autenticação se fornecido
    if (secret) {
      headers['Authorization'] = `Bearer ${secret}`;
    }

    // Enviar requisição para o webhook
    console.log(`Enviando teste para webhook ${webhookId} na URL: ${url}`);
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(testPayload),
    });

    // Processar resposta
    const responseStatus = response.status;
    let responseData;
    
    try {
      responseData = await response.json();
    } catch (e) {
      responseData = { text: await response.text() };
    }

    // Retornar resultado
    if (responseStatus >= 200 && responseStatus < 300) {
      return res.status(200).json({
        success: true,
        message: `Webhook testado com sucesso! Código de status: ${responseStatus}`,
        result: {
          statusCode: responseStatus,
          data: responseData
        }
      });
    } else {
      return res.status(200).json({
        success: false,
        message: `Falha no teste do webhook. Código de status: ${responseStatus}`,
        error: `O servidor de destino respondeu com código ${responseStatus}`,
        result: {
          statusCode: responseStatus,
          data: responseData
        }
      });
    }
  } catch (error) {
    console.error("Erro ao testar webhook:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Erro ao testar webhook",
      error: error instanceof Error ? error.message : "Erro desconhecido" 
    });
  }
}
