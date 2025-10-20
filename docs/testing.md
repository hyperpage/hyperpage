# Testing Guide

This guide covers the comprehensive testing strategy, framework selection, and quality assurance practices for Hyperpage.

## Testing Overview

Hyperpage maintains a robust testing strategy with unit tests, integration tests, and end-to-end scenarios to ensure code reliability and maintain high quality standards.

### Testing Frameworks

- **Unit Tests:** Vitest + React Testing Library
- **E2E Tests:** Playwright (headless browser testing)
- **Mocking:** Integrated vi.mock for API and component isolation
- **Coverage:** Code coverage analysis available

## Test Structure

- **69 unit tests** across components, utilities, and API routes
- **Framework optimization** completed (hardened mock infrastructure)
- **Code coverage reporting** available via `test:coverage`
- **Watch mode** for development workflow
- **E2E tests** ready with Playwright (requires environment setup)

### Current Test Results

**Test Status:** Active development framework
- ESLint quality: 67/68 issues resolved (98.5% clean)
- Build integration: All tests compile without errors
- Mock systems: Properly configured for isolation testing

## Running Tests

### Unit & Integration Tests

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run in watch mode during development
npm run test:watch

# Run with UI
npm run test:ui
```

### End-to-End Testing

E2E tests require proper environment setup and are designed for manual verification scenarios.

```bash
# Install Playwright browsers (one-time setup)
npm run test:e2e:install

# Run E2E tests (requires dev server configuration)
npm run test:e2e

# Run E2E tests in debug mode
npm run test:e2e:debug

# Run E2E tests with visual interface
npm run test:e2e:ui
```

## Development Quality Assurance

### Verified Components

✅ **Confirmed Quality Standards:**
- Next.js 15 API route compatibility
- React hook testing with proper act() wrappers
- Mock infrastructure for isolated testing
- Async state management validation

### Documented Optimization Needs

🔄 **Acknowledged Improvements:**
- E2E test environment setup (dev server integration)
- Mock handler execution refinements
- Concurrent operation edge cases

## CI/CD Integration

All tests run in automated pipelines to maintain continuous quality:

```bash
npm ci && npm test && npm run test:coverage
```

## Testing Architecture

### Mock Infrastructure
- **vi.mock**: Comprehensive API mocking for unit tests
- **Component Isolation**: Mocked external dependencies
- **Test Doubles**: Clean separation between tests

### Coverage Goals
- **Statement Coverage**: Target >90%
- **Branch Coverage**: Focus on critical paths
- **Function Coverage**: Ensure utility functions tested

### Test Organization
- **Unit Tests**: `/__tests__/` directory mirroring source structure
- **Integration Tests**: API route and component interaction
- **E2E Tests**: Complete user flow validation with Playwright

## Performance Benchmarks

Current testing framework demonstrates:
- **Load Times**: Tests complete under 30 seconds
- **Memory Usage**: Efficient test execution without leaks
- **Parallel Execution**: Multiple test suites run concurrently
- **CI Compatibility**: Optimized for continuous integration

## Troubleshooting

### Common Testing Issues

**"Tests failing on fresh clone"**
- Run `npm install` to ensure all dependencies
- Check that `.env.local` contains test configurations
- Verify Node.js version 18+

**"Mock errors in tests"**
- Clear test cache: `npm run test:clean-cache`
- Reset Vitest state: `npm run test:reset`
- Check mock configurations are properly imported

**"E2E tests timing out"**
- Ensure development server is running: `npm run dev`
- Configure longer timeouts in Playwright config
- Check network connectivity to test endpoints

## Contributing to Tests

When adding new features:

1. **Write unit tests** for all new functions and components
2. **Add integration tests** for API routes and data flows
3. **Update mocks** when changing external APIs
4. **Run full test suite** before submitting PRs

### Test Best Practices

- **Test Isolation**: Each test should be independent
- **Meaningful Names**: Describe what the test validates
- **Mock Wisely**: Only mock external dependencies
- **Clean Up**: Ensure no test state pollution

### Code Coverage Requirements

- **New Code**: Minimum 90% coverage
- **Critical Paths**: 100% coverage for error handling
- **Regression Tests**: Cover bug fixes permanently

For implementation details, see [`docs/api.md`](api.md) and [`docs/architecture.md`](architecture.md).
