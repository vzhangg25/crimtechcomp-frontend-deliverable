/**
 * API Client for Articles API
 * 
 * For local development, use the mock API server (see api-server/README.md)
 * For production, set VITE_API_BASE_URL environment variable or update this constant
 */

import type { ArticlesListResponse, ArticlesListParams, ArticleDetail } from '../types';

// Use environment variable if set, otherwise default to local mock API
// For production, set VITE_API_BASE_URL=https://<provided-domain>/api
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

/**
 * Fetches a paginated list of articles
 */
export async function fetchArticles(params: ArticlesListParams = {}): Promise<ArticlesListResponse> {
  const { cursor = null, limit = 10, q = null } = params;
  
  const searchParams = new URLSearchParams();
  if (cursor) searchParams.set('cursor', cursor);
  if (limit) searchParams.set('limit', limit.toString());
  if (q) searchParams.set('q', q);
  
  const url = `${API_BASE_URL}/articles?${searchParams.toString()}`;
  
  console.log(`[API] Fetching articles: ${url}`);
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch articles: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetches a single article by ID
 */
export async function fetchArticle(id: string): Promise<ArticleDetail> {
  const url = `${API_BASE_URL}/articles/${id}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch article: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}
