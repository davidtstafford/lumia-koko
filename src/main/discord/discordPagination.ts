/**
 * Discord Pagination Service
 * Manages pagination state for voice lists
 */

interface PaginationState {
  voices: any[];
  filters: any;
  currentPage: number;
  itemsPerPage: number;
  totalPages: number;
  timestamp: number;
}

// Store pagination states by userId + interactionId
const paginationCache = new Map<string, PaginationState>();

// Auto-cleanup after 10 minutes
const CACHE_TTL = 10 * 60 * 1000;

/**
 * Create a cache key
 */
function getCacheKey(userId: string, interactionId: string): string {
  return `${userId}:${interactionId}`;
}

/**
 * Store pagination state
 */
export function setPaginationState(
  userId: string,
  interactionId: string,
  voices: any[],
  filters: any,
  itemsPerPage: number
): void {
  const totalPages = Math.ceil(voices.length / itemsPerPage);
  const key = getCacheKey(userId, interactionId);

  paginationCache.set(key, {
    voices,
    filters,
    currentPage: 1,
    itemsPerPage,
    totalPages,
    timestamp: Date.now()
  });

  // Cleanup old entries
  cleanupExpiredStates();
}

/**
 * Get pagination state
 */
export function getPaginationState(userId: string, interactionId: string): PaginationState | null {
  const key = getCacheKey(userId, interactionId);
  return paginationCache.get(key) || null;
}

/**
 * Update current page
 */
export function updateCurrentPage(
  userId: string,
  interactionId: string,
  newPage: number
): boolean {
  const key = getCacheKey(userId, interactionId);
  const state = paginationCache.get(key);

  if (!state) return false;

  state.currentPage = Math.max(1, Math.min(newPage, state.totalPages));
  state.timestamp = Date.now();
  return true;
}

/**
 * Get voices for current page
 */
export function getPageVoices(userId: string, interactionId: string): any[] {
  const state = getPaginationState(userId, interactionId);
  if (!state) return [];

  const startIdx = (state.currentPage - 1) * state.itemsPerPage;
  const endIdx = startIdx + state.itemsPerPage;
  return state.voices.slice(startIdx, endIdx);
}

/**
 * Get pagination info
 */
export function getPaginationInfo(userId: string, interactionId: string): {
  currentPage: number;
  totalPages: number;
  totalVoices: number;
  startIdx: number;
  endIdx: number;
} | null {
  const state = getPaginationState(userId, interactionId);
  if (!state) return null;

  const startIdx = (state.currentPage - 1) * state.itemsPerPage + 1;
  const endIdx = Math.min(state.currentPage * state.itemsPerPage, state.voices.length);

  return {
    currentPage: state.currentPage,
    totalPages: state.totalPages,
    totalVoices: state.voices.length,
    startIdx,
    endIdx
  };
}

/**
 * Clear pagination state
 */
export function clearPaginationState(userId: string, interactionId: string): void {
  const key = getCacheKey(userId, interactionId);
  paginationCache.delete(key);
}

/**
 * Cleanup expired states
 */
function cleanupExpiredStates(): void {
  const now = Date.now();
  for (const [key, state] of paginationCache.entries()) {
    if (now - state.timestamp > CACHE_TTL) {
      paginationCache.delete(key);
    }
  }
}

/**
 * Get cache stats (for debugging)
 */
export function getCacheStats(): {
  totalStates: number;
  totalVoices: number;
} {
  let totalVoices = 0;
  for (const state of paginationCache.values()) {
    totalVoices += state.voices.length;
  }

  return {
    totalStates: paginationCache.size,
    totalVoices
  };
}
