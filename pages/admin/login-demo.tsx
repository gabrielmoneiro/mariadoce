import { useState } from 'react';
import { useRouter } from 'next/router';
import styles from '@/styles/AdminLogin.module.css';
import transitions from '@/styles/AdminTransitions.module.css';

const AdminLoginDemo = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    
    // Simular delay de login
    setTimeout(() => {
      if (email && password) {
        router.push('/admin/dashboard-demo');
      } else {
        setError('Por favor, preencha todos os campos.');
        setIsLoading(false);
      }
    }, 1000);
  };

  return (
    <div className={`${styles.loginContainer} ${transitions.pageTransition}`}>
      <h2 className={transitions.slideInLeft}>Login de Administrador</h2>
      <form onSubmit={handleLogin} className={transitions.slideInRight}>
        <div className={`${styles.formGroup} ${transitions.fadeIn}`}>
          <label htmlFor="email">Email:</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="seuemail@exemplo.com"
            className={transitions.formField}
            disabled={isLoading}
          />
        </div>
        <div className={`${styles.formGroup} ${transitions.fadeIn}`} style={{animationDelay: '0.1s'}}>
          <label htmlFor="password">Senha:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Sua senha"
            className={transitions.formField}
            disabled={isLoading}
          />
        </div>
        {error && (
          <p className={`${styles.error} ${transitions.notification}`}>
            {error}
          </p>
        )}
        <button 
          type="submit" 
          className={`${styles.loginButton} ${transitions.buttonHover} ${transitions.scaleIn}`}
          style={{animationDelay: '0.2s'}}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <span className={transitions.loadingSpinner}></span>
              <span className={transitions.loadingDots}>Entrando</span>
            </>
          ) : (
            'Entrar'
          )}
        </button>
      </form>
    </div>
  );
};

export default AdminLoginDemo;

