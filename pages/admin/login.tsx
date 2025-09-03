import { useState } from 'react';
import { useRouter } from 'next/router';
import { signInWithEmailAndPassword, AuthError } from 'firebase/auth'; // Importado AuthError
import { auth } from '@/lib/firebase';
import styles from '@/styles/AdminLogin.module.css';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/admin/dashboard');
    } catch (err: unknown) { // CORREÇÃO: Tipo 'any' substituído por 'unknown'
      console.error("Erro de login:", err);
      let mensagemErro = 'Falha ao fazer login. Verifique as suas credenciais.';
      
      // VERIFICA SE O ERRO TEM A PROPRIEDADE CODE
      if (err && typeof err === 'object' && 'code' in err) {
        const authErr = err as { code: string };
        if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/wrong-password' || authErr.code === 'auth/invalid-credential') {
          mensagemErro = 'Email ou senha inválidos. Por favor, tente novamente.';
        } else if (authErr.code === 'auth/invalid-email') {
          mensagemErro = 'O formato do email é inválido.';
        }
      }
      setError(mensagemErro);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <h2>Login de Administrador</h2>
      <form onSubmit={handleLogin}>
        <div className={styles.formGroup}>
          <label htmlFor="email">Email:</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="seuemail@exemplo.com"
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="password">Senha:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Sua senha"
          />
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <button type="submit" className={styles.loginButton}>Entrar</button>
      </form>
    </div>
  );
};

export default AdminLogin;