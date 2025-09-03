import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';

import styles from '../styles/SearchBar.module.css';

interface SearchBarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const SearchBar = ({ isOpen, onToggle }: SearchBarProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 200);
    } else {
      setIsAnimating(false);
    }
  }, [isOpen]);

  const debounce = useCallback((func: Function, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
  }, []);

  const performSearch = useCallback((term: string) => {
    if (!term.trim()) {
      if (router.pathname !== '/') {
        router.push('/');
      }
      return;
    }

    router.push({
      pathname: '/',
      query: { search: term.trim() }
    }).finally(() => {});
  }, [router]);

  const debouncedSearch = useCallback(
    debounce(performSearch, 300),
    [performSearch]
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    debouncedSearch(value);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchTerm);
  };

  const clearSearch = () => {
    setSearchTerm('');
    if (router.query.search) {
      router.push('/');
    }
    searchInputRef.current?.focus();
  };

  return (
    <div className={`${styles.searchContainer} ${isOpen ? styles.expanded : ''} ${isAnimating ? styles.animating : ''}`}>
      <div className={styles.searchBox}>
        <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
          <input
            type="text"
            className={`${styles.searchInput} ${isOpen ? styles.visible : ''}`}
            placeholder="Pesquise produtos aqui..."
            value={searchTerm}
            onChange={handleSearchChange}
            ref={searchInputRef}
          />
        </form>
        <button
          type="button"
          className={styles.searchButton}
          onClick={onToggle}
          aria-label="Abrir ou fechar pesquisa"
        >
          <Image
            src="/assets/search-icon-new.svg"
            alt="Pesquisar"
            width={36}
            height={36}
            className={`${styles.searchIcon} ${isOpen ? styles.hidden : ''}`}
          />

        </button>

      </div>
    </div>
  );
};

export default SearchBar;