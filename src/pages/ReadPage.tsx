import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchArticles } from '../api/client';
import type { ArticleListItem } from '../types';
import './ReadPage.css';

const STORAGE_KEY = 'articleReader_state';
const THEME_KEY = 'articleReader_theme';

interface SavedState {
  articles: ArticleListItem[];
  nextCursor: string | null;
  hasMore: boolean;
  searchQuery: string;
  scrollPosition: number;
}

function getInitialTheme(): 'light' | 'dark' {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function ReadPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);
  
  const sentinelRef = useRef<HTMLDivElement>(null);
  const articleRefs = useRef<Map<string, HTMLElement>>(new Map());
  const isLoadingRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveState = useCallback(() => {
    const state: SavedState = {
      articles,
      nextCursor,
      hasMore,
      searchQuery,
      scrollPosition: window.scrollY,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [articles, nextCursor, hasMore, searchQuery]);

  const loadSavedState = (): SavedState | null => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load saved state:', e);
    }
    return null;
  };
  const loadArticles = useCallback(async (cursor: string | null = null, query: string = searchQuery, isNewSearch: boolean = false) => {
    if (isLoadingRef.current) return;
    
    isLoadingRef.current = true;
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetchArticles({
        cursor,
        limit: 10,
        q: query || null,
      });
      
      if (isNewSearch) {
        setArticles(response.items);
      } else {
        setArticles(prev => cursor ? [...prev, ...response.items] : response.items);
      }
      setNextCursor(response.nextCursor);
      setHasMore(response.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load articles');
    } finally {
      setLoading(false);
      setInitialLoading(false);
      setIsSearching(false);
      isLoadingRef.current = false;
    }
  }, [searchQuery]);
// called when user scrolls to the bottom of the page, only loads if not already loading
  const loadMore = useCallback(() => {
    if (!isLoadingRef.current && hasMore && nextCursor) {
      loadArticles(nextCursor);
    }
  }, [hasMore, nextCursor, loadArticles]);

  useEffect(() => {
    const savedState = loadSavedState();
    
    if (savedState && savedState.articles.length > 0 && !searchParams.get('q')) {
      setArticles(savedState.articles);
      setNextCursor(savedState.nextCursor);
      setHasMore(savedState.hasMore);
      setSearchQuery(savedState.searchQuery);
      setInitialLoading(false);
      
      requestAnimationFrame(() => {
        window.scrollTo(0, savedState.scrollPosition);
      });
    } else {
      loadArticles(null, searchParams.get('q') || '');
    }
  }, []);

  useEffect(() => {
    if (articles.length > 0) {
      saveState();
    }
  }, [articles, nextCursor, hasMore, searchQuery, saveState]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      saveState();
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveState]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMore && !isLoadingRef.current) {
          loadMore();
        }
      },
      {
        rootMargin: '200px',
        threshold: 0,
      }
    );
    
    observerRef.current = observer;
    
    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }
    
    return () => {
      observer.disconnect();
    };
  }, [hasMore, loadMore]);

  useEffect(() => {
    const articleObserver = new IntersectionObserver(
      (entries) => {
        let maxRatio = 0;
        let mostVisibleId: string | null = null;
        
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            mostVisibleId = entry.target.getAttribute('data-article-id');
          }
        });
        
        if (mostVisibleId && mostVisibleId !== activeArticleId) {
          setActiveArticleId(mostVisibleId);
          const newUrl = `/read/${mostVisibleId}${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ''}`;
          window.history.replaceState(null, '', newUrl);
        }
      },
      {
        rootMargin: '-20% 0px -60% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );
    
    articleRefs.current.forEach((element) => {
      articleObserver.observe(element);
    });
    
    return () => {
      articleObserver.disconnect();
    };
  }, [articles, activeArticleId, searchQuery]);

  const debouncedSearch = useCallback((query: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      setNextCursor(null);
      setHasMore(true);
      
      if (query) {
        setSearchParams({ q: query });
      } else {
        setSearchParams({});
      }
      
      sessionStorage.removeItem(STORAGE_KEY);
      loadArticles(null, query, true);
    }, 300);
  }, [loadArticles, setSearchParams]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setIsSearching(true);
    debouncedSearch(query);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchParams({});
    setNextCursor(null);
    setHasMore(true);
    setIsSearching(true);
    sessionStorage.removeItem(STORAGE_KEY);
    loadArticles(null, '', true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const setArticleRef = (id: string, element: HTMLElement | null) => {
    if (element) {
      articleRefs.current.set(id, element);
    } else {
      articleRefs.current.delete(id);
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem(THEME_KEY, newTheme);
  };

  return (
    <div className={`read-page ${theme}`}>
      <header className="read-header">
        <div className="header-top">
          <div className="header-brand">
            <h1>The Harvard Crimson</h1>
            <p className="header-tagline">The University Daily Est. 1873</p>
            <p className="header-date">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              <span className="header-volume">VOLUME CLIII</span>
            </p>
          </div>
          <button 
            className="theme-toggle" 
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            )}
          </button>
        </div>
        <div className="search-container">
          <div className="search-input-wrapper">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Search articles by title, author, or topic..."
              value={searchQuery}
              onChange={handleSearchChange}
            />
            {searchQuery && (
              <button className="search-clear" onClick={clearSearch} aria-label="Clear search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="search-results-count">
              {articles.length} article{articles.length !== 1 ? 's' : ''} found
              {hasMore && '+'}
            </p>
          )}
        </div>
      </header>
      
      <main className="read-content">
        {initialLoading && (
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>Loading articles...</p>
          </div>
        )}
        
        {error && !initialLoading && (
          <div className="error-state">
            <svg className="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <p>Error: {error}</p>
            <button onClick={() => loadArticles(null, searchQuery, true)}>Try Again</button>
          </div>
        )}
        
        {articles.length === 0 && !initialLoading && !loading && !isSearching && !error && (
          <div className="empty-state">
            <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <p>No articles found{searchQuery ? ` for "${searchQuery}"` : ''}.</p>
            {searchQuery && (
              <button onClick={clearSearch}>Clear search</button>
            )}
          </div>
        )}
        
        <div className="articles-list">
          {articles.map((article) => (
            <article
              key={article.id}
              ref={(el) => setArticleRef(article.id, el)}
              data-article-id={article.id}
              className={`article-card ${activeArticleId === article.id ? 'active' : ''}`}
            >
              {article.imageUrl && (
                <div className="article-image-container">
                  <img
                    src={article.imageUrl}
                    alt={article.title}
                    className="article-image"
                    loading="lazy"
                  />
                </div>
              )}
              <div className="article-header">
                <h2 className="article-title">{article.title}</h2>
                <p className="article-dek">{article.dek}</p>
                <div className="article-meta">
                  <span className="article-author">By {article.author}</span>
                  <span className="meta-separator">·</span>
                  <span className="article-date">{formatDate(article.publishedAt)}</span>
                  <span className="meta-separator">·</span>
                  <span className="article-reading-time">{article.readingTimeMins} min read</span>
                </div>
              </div>
              <div
                className="article-content"
                dangerouslySetInnerHTML={{ __html: article.contentHtml }}
              />
            </article>
          ))}
        </div>
        
        <div ref={sentinelRef} className="scroll-sentinel" />
        
        {loading && articles.length > 0 && (
          <div className="loading-more">
            <div className="loading-spinner small" />
            <span>Loading more articles...</span>
          </div>
        )}
        
        {!hasMore && articles.length > 0 && (
          <div className="end-state">
            <svg className="end-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <p>You're all caught up!</p>
            <span className="end-subtitle">You've read all {articles.length} articles</span>
            <button 
              className="back-to-top-button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
              Back to Top
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
