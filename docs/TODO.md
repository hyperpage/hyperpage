# Rate Limiting Avoidance - Implementation Tasks

This document outlines the detailed implementation tasks needed to prevent rate limiting issues from external platforms (GitHub, GitLab, Jira, etc.) in Hyperpage.

## 🎯 Task Overview

Based on the analysis of the current codebase, the following categories of improvements are needed:
- Platform-aware error handling and retry logic
- Dynamic polling frequency management
- Intelligent caching strategies
- Rate limit monitoring and user feedback
- Request deduplication and optimization

---

## 🚨 Core Infrastructure Tasks

### 1. Implement Intelligent Backoff & Retry Logic ![✅ COMPLETED]

**Priority: High** | **Effort: Medium** | **Duration: 2-3 hours** | **Status: COMPLETE**

#### Subtasks:
- [x] Create centralized `APIClient` utility in `lib/api-client.ts`
- [x] Implement exponential backoff algorithm: `1s → 2s → 4s → max 60s`
- [x] Add rate limit header detection (`X-RateLimit-Remaining`, `X-RateLimit-Reset`)
- [x] Create retry wrapper function supporting platform-specific strategies:
  - **GitHub**: Respect `X-RateLimit-Reset` header timing
  - **GitLab**: Use `Retry-After` header when present
  - **Jira**: Implement gradual backoff on 429 responses

#### 💡 **Enhanced Architecture (Bonus Implementation)**
- **Registry-Driven Design**: Platform-specific logic moved to individual tool configurations
- **Extensible Framework**: New tools can easily define custom rate limiting behavior
- **Multi-Platform Support**: Intelligent handling for GitHub, GitLab, and Jira rate limits

#### Code Signature:
```typescript
// Tool-configured rate limiting (current)
export const makeRetryRequest = async (
  url: string,
  options: RequestInit,
  config: {
    rateLimitConfig: ToolRateLimitConfig
  }
): Promise<Response>

// Original planned signature (superseded)
// export const makeRetryRequest = async (
//   url: string,
//   options: RequestInit,
//   config: {
//     maxRetries: number;
//     platform: 'github' | 'gitlab' | 'jira';
//     backoffStrategy?: 'exponential' | 'linear';
//   }
// ): Promise<Response>
```

### 2. Add Rate Limit Status Monitoring ![✅ COMPLETED]

**Priority: High** | **Effort: Medium** | **Duration: 2 hours** | **Status: COMPLETE**

#### ✅ All Subtasks Completed:
- [x] Create rate limit status type definitions in `lib/types/rate-limit.ts`
- [x] Implement `/api/rate-limit/[platform]` endpoint for status checking
- [x] Add rate limit cache with automatic expiration (5-minute TTL)
- [x] Create React hook `useRateLimit()` for components to access status
- [x] Add visual indicators in UI when approaching rate limits:
  - Show usage percentage in tool status badges ✅
  - Color-coded warnings (yellow: >75%, red: >90%) ✅

#### ✅ **Additional Multi-Platform Implementation:**
- **GitHub**: Full rate limit monitoring (core/search/graphql APIs)
- **GitLab**: Retry-After header parsing and status inference
- **Jira**: 429 response handling with instance-specific logic
- **Status Calculation**: Automatic normal/warning/critical determination
- **Error Handling**: Graceful fallbacks with "unknown" status

#### Files Created/Updated:
- `lib/types/rate-limit.ts` ✅
- `lib/rate-limit-monitor.ts` ✅
- `app/api/rate-limit/[platform]/route.ts` ✅
- `app/components/hooks/useRateLimit.ts` ✅
- `app/components/ToolStatusRow.tsx` (visual indicators) ✅

---

## ⚡ Dynamic Polling & Caching Tasks

### 3. Implement Adaptive Polling ![✅ COMPLETED]

**Priority: Medium** | **Effort: High** | **Duration: 3-4 hours** | **Status: COMPLETE**

#### ✅ **Implemented Subtasks**:
- [x] Modify `useToolQueries` hook to support dynamic intervals with real-time adaptation
- [x] Create `getDynamicInterval()` utility that adjusts based on usage:
  ```typescript
  // GitHub/GitLab/Jira rate-aware polling
  const getDynamicInterval = (usagePercent: number, baseInterval: number): number => {
    if (usagePercent >= 90) return baseInterval * 4; // 4x slower
    if (usagePercent >= 75) return baseInterval * 2; // 2x slower
    if (usagePercent >= 50) return baseInterval * 1.5; // 1.5x slower
    return baseInterval; // Normal speed
  };
  ```
- [x] Update `useToolQueries` with dynamic React Query `refetchInterval` adjustments
- [x] Add `detectBusinessHours()` with 20% slowdown during Mon-Fri 9AM-6PM
- [x] Implement user activity detection (keyboard/mouse/scroll events, 5min timeout → 1.5x slower)
- [x] Implement tab visibility detection (hidden tabs → 2x-3x slower polling)
- [x] Add `getActivityAccelerationFactor()` for comprehensive user context awareness
- [x] Comprehensive test suite (33 tests) covering all adaptive polling scenarios

### 4. Add Response Caching Layer ![✅ COMPLETED]

**Priority: Medium** | **Effort: Medium** | **Duration: 3 hours** | **Status: COMPLETE**

#### ✅ **Implemented Subtasks**:
- [x] Create `lib/cache/memory-cache.ts` with TTL support and LRU eviction
- [x] Implement smart cache invalidation based on:
  - **TTL expiry**: Automatic cleanup of stale entries
  - **User-triggered refreshes**: `cache-control: no-cache` and `x-cache-bypass` headers
  - **Rate limiting events**: Skip caching for 429 and 5xx error responses
- [x] Add cache headers to API responses:
  - `Cache-Control: private, max-age=30` for client-side caching
  - `X-Cache-Status: HIT/MISS/BYPASS/ERROR` for debugging
  - `X-Cache-Key` for cache key visibility
- [x] Cache strategy: `memory-first → API-fallback → error` implemented in `executeHandler`
- [x] Cache size limits with FIFO eviction (1000 entries max with automatic cleanup)
- [x] Comprehensive test suite (20 tests, all passing) for cache functionality

#### 📊 **Performance Metrics**:
- **Hit Rate Monitoring**: Cache statistics exposed via `/api/health` endpoint
- **Hit Rate Calculation**: `(hits / (hits + misses)) * 100` percentage tracking
- **Statistics**: Entries with size, hits, misses, expiries, evictions tracking
- **Debugging Support**: Cache key generation and metadata access for troubleshooting

#### 🔧 **Technical Implementation Details**:
- **Cache Key Strategy**: `${toolName}:${endpoint}:${Base64(queryParamsHash)}`
- **TTL Defaults**: 5 minutes for activity endpoints, 10 minutes for static data
- **Invalidation Triggers**: TTL, user refresh requests, error responses
- **Memory Management**: Automatic cleanup, size limits, and statistics tracking

#### Cache Key Strategy:
```typescript
const cacheKey = `${toolName}:${endpoint}:${queryParamsHash}`;
```

---

## 🔧 Platform-Specific Optimizations

### 5. GitHub-Specific Improvements ![✅ COMPLETED]

**Priority: High** | **Effort: Low** | **Duration: 1-2 hours** | **Status: COMPLETE**

#### ✅ **Implemented Improvements**:
- [x] **Use GitHub rate limit API endpoint proactively**: Native `/rate_limit` API monitoring implemented ✅
- [x] **Adjust activity polling based on core/search quota usage**: GitHub-specific weighted usage assessment added
  - **Search API** prioritized (30/min limit) over core/GraphQL (5000/hour)
  - Weighted algorithm: Search ×1.5, GraphQL ×0.8, Core ×0.7
  - `getGitHubWeightedUsage()` function integrated into adaptive polling
- [ ] ~~Implement GraphQL batched requests for complex queries~~: **Future enhancement - requires GraphQL client integration**
- [ ] ~~Add GitHub App authentication support for higher rate limits~~: **Future enhancement - requires webhooks & installation flow**

#### ✅ **Key Implementation Details**:
- **Rate Limit Awareness**: Polling now adapts based on which GitHub API resources are most constrained
- **Search API Sensitivity**: System automatically slows down when search quota is low (most restrictive API)
- **API Resource Weighting**: Core/GraphQL/GraphQL APIs weighted appropriately by their rate limits
- **Backward Compatible**: Works with existing rate limit monitoring infrastructure
- **Configurable Search Multiplier**: `searchMultiplier` parameter allows fine-tuning Search API sensitivity

### 6. GitLab Rate Limit Handling ![✅ COMPLETED]

**Priority: Medium** | **Effort: Low** | **Duration: 1 hour** | **Status: COMPLETE**

#### ✅ **All Subtasks Completed:**
- [x] Add `Retry-After` header parsing for 429 responses
- [x] Implement user notification for rate limiting
- [x] Create fallback to reduced data when rate limited
- [x] Document GitLab Premium rate limit differences

### 7. Jira Adaptive Strategies

**Priority: Medium** | **Effort: Medium** | **Duration: 2 hours**

#### Subtasks:
- [ ] Add instance-specific rate monitoring (varies by Jira instance size)
- [ ] Implement batching for changelog requests
- [ ] Cache project metadata for 24 hours
- [ ] Add advisory locking to prevent concurrent API storms

---

## 🎛️ User Experience Enhancements

### 8. User-Controllable Refresh Rates

**Priority: Low** | **Effort: Medium** | **Duration: 2-3 hours**

#### Subtasks:
- [ ] Create user preferences UI for refresh intervals
- [ ] Add per-tool refresh frequency settings:
  - High: 15-30 seconds (development teams)
  - Medium: 2-5 minutes (most users)
  - Low: 10-15 minutes (light users)
- [ ] Implement manual pause functionality for dashboards
- [ ] Add browser tab visibility awareness (stop polling when hidden)

#### UI Components:
- `app/components/settings/RefreshSettings.tsx`
- `app/components/common/PauseResumeButton.tsx`

### 9. Rate Limit User Notifications

**Priority: Low** | **Effort: Low** | **Duration: 1 hour**

#### Subtasks:
- [ ] Add toast notifications for rate limiting events
- [ ] Show remaining API calls in tool status indicators
- [ ] Display next refresh time during cooldown periods
- [ ] Create help documentation links for increasing API limits

---

## 🧪 Testing & Quality Assurance

### 10. Rate Limiting Test Suite

**Priority: Medium** | **Effort: High** | **Duration: 4-5 hours**

#### Subtasks:
- [ ] Create mock rate limiting server for testing
- [ ] Add unit tests for backoff/retry logic
- [ ] Integration tests for dynamic polling behavior
- [ ] End-to-end tests for rate limit UI feedback
- [ ] Performance tests with simulated high-frequency scenarios

#### Test Files:
- `__tests__/lib/rate-limit-utils.test.ts`
- `__tests__/integration/rate-limiting.test.ts`
- `__tests__/e2e/rate-limit-handling.spec.ts`

### 11. Observability & Monitoring

**Priority: Low** | **Effort: Medium** | **Duration: 2-3 hours**

#### Subtasks:
- [ ] Add rate limit metrics to existing health endpoint
- [ ] Create Prometheus metrics for API usage tracking
- [ ] Log rate limiting events for debugging
- [ ] Add dashboard for monitoring API performance across platforms

---

## 📋 Implementation Order & Dependencies

### Phase 1 (Week 1) - Core Infrastructure
1. Task 1: Implement Intelligent Backoff & Retry Logic
2. Task 2: Add Rate Limit Status Monitoring
3. Task 5: GitHub-Specific Improvements

### Phase 2 (Week 2) - Dynamic Behavior
4. Task 3: Implement Adaptive Polling Intervals
5. Task 4: Add Response Caching Layer

### Phase 3 (Week 3) - Platform Extensions
6. Task 6: GitLab Rate Limit Handling
7. Task 7: Jira Adaptive Strategies

### Phase 4 (Week 4) - UX Enhancements
8. Task 8: User-Controllable Refresh Rates
9. Task 9: Rate Limit User Notifications

### Phase 5 (Week 5) - Quality & Monitoring
10. Task 10: Rate Limiting Test Suite
11. Task 11: Observability & Monitoring

---

## 🔍 Success Metrics

Monitor these indicators to validate improvements:

- **API Error Rate**: Target <1% rate limiting errors
- **Data Freshness**: Average delay <30 seconds for critical data
- **User Satisfaction**: Reduce manual refresh frequency by 80%
- **Platform Coverage**: Support intelligent handling for all major platforms

---

## 🚦 Risk Assessment

**High Risk**:
- Breaking existing API integrations
- Over-caching leading to stale data
- Complex retry logic introducing race conditions

**Medium Risk**:
- Dynamic polling complexity
- Platform-specific edge cases

**Low Risk**:
- User preference UI
- Monitoring/metrics additions

---

## 📚 Related Documentation

- [Architecture Overview](../docs/architecture.md)
- [API Integration Patterns](../docs/api.md)
- [Security Practices](../docs/security-practices.md)
- [Component Development](../docs/ui.md)
