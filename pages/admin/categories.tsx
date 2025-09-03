import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import CategoryManager from '@/components/admin/CategoryManager';
import styles from '@/styles/AdminSettings.module.css';

const AdminCategoriesPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      
      if (!currentUser) {
        router.push('/admin/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (authLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Administração - Categorias</h1>
        <div className={styles.navigation}>
          <button 
            onClick={() => router.push('/admin/dashboard')}
            className={styles.navButton}
          >
            ← Voltar ao Dashboard
          </button>
          <button 
            onClick={() => router.push('/admin/settings')}
            className={styles.navButton}
          >
            Configurações
          </button>
        </div>
      </div>

      <div className={styles.content}>
        <CategoryManager />
      </div>
    </div>
  );
};

export default AdminCategoriesPage;

