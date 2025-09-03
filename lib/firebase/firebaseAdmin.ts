import * as admin from 'firebase-admin';

// Inicializar o Firebase Admin SDK
if (!admin.apps.length) {
  try {
    // Verificar se estamos em ambiente de produção ou desenvolvimento
    if (process.env.FIREBASE_PRIVATE_KEY) {
      // Ambiente de produção (Vercel) - usar variáveis de ambiente
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID || 'ms-vendas',
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          // A Vercel armazena a chave privada com \n escapados, precisamos substituí-los
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        }),
        databaseURL: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ms-vendas'}.firebaseio.com`
      });
      console.log('Firebase Admin inicializado em modo produção');
    } else {
      // Ambiente de desenvolvimento - tentar usar arquivo de serviço local
      try {
        // Tente carregar o arquivo de serviço local (não deve ser commitado no repositório)
        const serviceAccount = require('../../../firebase-service-account.json');
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ms-vendas'}.firebaseio.com`
        });
        console.log('Firebase Admin inicializado com arquivo de serviço local');
      } catch (localError) {
        // Se não conseguir carregar o arquivo local, inicialize com configuração mínima
        // Isso permitirá que o código seja executado, mas as operações do Firestore falharão
        console.warn('Arquivo de serviço não encontrado, inicializando Firebase Admin com configuração mínima');
        console.warn('As operações do Firestore falharão até que as credenciais corretas sejam fornecidas');
        console.warn('Erro:', localError);
        
        admin.initializeApp({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ms-vendas'
        });
      }
    }
  } catch (error) {
    console.error('Erro ao inicializar Firebase Admin:', error);
  }
}

export const db = admin.firestore();
export const auth = admin.auth();
export const storage = admin.storage();
export default admin;

