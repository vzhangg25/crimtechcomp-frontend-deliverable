import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { fetchArticles } from '../api/client';
import type { ArticleListItem } from '../types';
import './ReadPage.css';

const STORAGE_KEY = 'articleReader_state';

interface SavedState {
  articles: ArticleListItem[];
  nextCursor: string | null;
  hasMore: boolean;
  searchQuery: string;
  scrollPosition: number;
}

function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
  let timeoutId: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T;
}

export default function ReadPage() {
  const { articleId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);
  
  const sentinelRef = useRef<HTMLDivElement>(null);
  const articleRefs = useRef<Map<string, HTMLElement>>(new Map());
  const isLoadingRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

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
      
      console.log(`[API Response] Received ${response.items.length} articles, hasMore: ${response.hasMore}, nextCursor: ${response.nextCursor}`);
      
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
      isLoadingRef.current = false;
    }
  }, [searchQuery]);

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

  const debouncedSearch = useCallback(
    debounce((query: string) => {
      setArticles([]);
      setNextCursor(null);
      setHasMore(true);
      
      if (query) {
        setSearchParams({ q: query });
      } else {
        setSearchParams({});
      }
      
      sessionStorage.removeItem(STORAGE_KEY);
      loadArticles(null, query, true);
    }, 300),
    [loadArticles, setSearchParams]
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    debouncedSearch(query);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchParams({});
    setArticles([]);
    setNextCursor(null);
    setHasMore(true);
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

  return (
    <div className="read-page">
      <header className="read-header">
        <h1>Article Reader</h1>
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
        
        {articles.length === 0 && !initialLoading && !error && (
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
          </div>
        )}
      </main>
    </div>
  );
}
