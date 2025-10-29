---
description: Guidelines to prevent marketing hype and false metrics in documentation, commits, and chat
author: Generated from documentation cleanup task
version: 1.0
tags: ["documentation", "commits", "chat", "marketing", "accuracy", "technical-writing"]
severity: "high"
---

# Documentation Accuracy: Avoid Marketing Hype and False Metrics

## Critical Rule: No False Claims in Documentation, Commits, or Chat

**MANDATORY INSTRUCTION**: All documentation, README.md, architectural descriptions, commit messages, and chat responses **MUST** accurately reflect the current state of the codebase. No marketing hype, aspirational claims, or false metrics are allowed.

## Prohibited Content Patterns

### ❌ **False Test Metrics**
- ~~"50/50 unit tests passing"~~ → **If including counts, verify actual numbers**
- ~~"100% success rate"~~ → **Use factual language like "automated tests ensure stability"**
- ~~"56/56 unit tests passed | 0 failed"~~ → **Avoid specific counts with minimal verification**

### ❌ **False Performance Claims**
- ~~"Dashboard loads in under 3 seconds"~~ → **No unsubstantiated performance benchmarks**
- ~~"Tests complete under 30 seconds"~~ → **Remove statements that imply measured but unverified metrics**
- ~~"Zero compiler errors, clean production builds"~~ → **Do not pretend current state is perfect**

### ❌ **False Feature Claims**
- ~~Advanced adaptive polling with 4x slower intervals~~ → **Describe actual implementation only**
- ~~"Intelligent API quota management"~~ → **Use accurate terms like "Rate limit monitoring"**
- ~~"Virtual scrolling for large datasets"~~ → **Only document features that exist**

### ❌ **UI Framework False Claims**
- ~~"Using DaisyUI components"~~ → **Must match actual dependencies (e.g., shadcn/ui)**
- ~~"Eliminated shadcn/ui dependencies"~~ → **Cannot contradict actual codebase**

### ❌ **Success Targets and Metrics**
- ~~"Reduce manual refresh frequency by 80%"~~ → **No made-up success metrics**
- ~~"ESLint issues reduced by 41%"~~ → **Require actual measurement if including numbers**
- ~~"Target <1% rate limiting errors"~~ → **No aspirational targets in completed features**

### ❌ **False Claims in Commit Messages**
- ~~"Fixed critical security vulnerability in authentication"~~ → **Only if actually fixed and verified**
- ~~"Optimized performance by 300%"~~ → **Require actual measurements**
- ~~"Added revolutionary new feature"~~ → **Use factual descriptions like "Add user login endpoint"**
- ~~"Refactored entire codebase for perfection"~~ → **Describe actual changes made**

### ❌ **False Claims in Chat Responses**
- ~~"This solution is enterprise-grade and battle-tested"~~ → **Describe actual implementation**
- ~~"I've implemented the most efficient algorithm possible"~~ → **Stick to factual technical details**
- ~~"This will solve all your scaling problems forever"~~ → **Describe what the change addresses specifically**
- ~~"Zero downtime guaranteed"~~ → **No absolute guarantees without verification**

## Approved Content Patterns

### ✅ **Accurate Documentation**
- **Before**: ~~"Comprehensive testing with 100% success rate"~~
- **After**: "Automated tests ensure reliability and stability"

- **Before**: ~~"56/56 unit tests passing (100% success rate)"~~
- **After**: "Test suite includes unit and integration tests"

- **Before**: ~~"Adaptive Rate Limit Management: Intelligent polling..."~~
- **After**: "Rate limit monitoring across enabled platforms"

### ✅ **Factual Architecture Descriptions**
- **Before**: ~~"Zero hardcoded logic"~~ (but switch cases exist)
- **After**: "Registry-driven architecture for tool integrations"

### ✅ **Honest Quality Assessments**
- **Before**: ~~"Production READY ✅" with specific metrics~~
- **After**: "Project includes automated testing"

### ✅ **Accurate Commit Messages**
- **Instead of**: ~~"Fixed critical security vulnerability in authentication"~~
- **Use**: "Fix password validation in login function"
- **Instead of**: ~~"Optimized performance by 300%"~~ (unmeasured)
- **Use**: "Improve query performance for user lookups" (measured improvement)
- **Instead of**: ~~"Added revolutionary new feature"~~
- **Use**: "Add user registration endpoint with email validation"
- **Instead of**: ~~"Refactored entire codebase for perfection"~~
- **Use**: "Refactor authentication middleware to improve error handling"

### ✅ **Factual Chat Responses**
- **Instead of**: ~~"This solution is enterprise-grade and battle-tested"~~
- **Use**: "This implementation follows standard authentication patterns"
- **Instead of**: ~~"I've implemented the most efficient algorithm possible"~~
- **Use**: "This implementation uses binary search for better performance on sorted data"
- **Instead of**: ~~"This will solve all your scaling problems forever"~~
- **Use**: "This caching layer will reduce database load for this specific query pattern"
- **Instead of**: ~~"Zero downtime guaranteed"~~
- **Use**: "The deployment process includes health checks to minimize service disruption"

## Verification Requirements

**MANDATORY CHECKS** before documenting:

### 1. Test Claims Verification
- [ ] Count actual test files: `find __tests__ -name "*.test.*" | wc -l`
- [ ] Verify dependencies: `grep "daisyui\|shadcn" package.json`
- [ ] Check TypeScript compilation state
- [ ] Run builds to confirm "clean" claims

### 2. Feature Implementation Verification
- [ ] Code search for claimed functionality
- [ ] Check rate limiting code for adaptive behavior
- [ ] Verify UI framework usage in components
- [ ] Confirm performance claims with actual testing

### 3. Architecture Claims Verification
- [ ] Review actual codebase for "zero hardcoded logic" claims
- [ ] Verify component architecture matches documents
- [ ] Check server/client separation claims
- [ ] Validate security implementation

### 4. Commit and Chat Verification
- [ ] Review commit messages for factual accuracy before pushing
- [ ] Ensure chat responses describe actual implementation without hype
- [ ] Verify performance claims in commits with actual measurements
- [ ] Cross-reference chat responses against implemented code

## Documentation Writing Rules

### Rule 1: Use Factual Language
- **Avoid**: Superlatives like "enterprise-grade", "production-ready", "hardened"
- **Use**: Specific, verifiable descriptions like "Next.js 15 codebase with TypeScript"

### Rule 2: No Aspirational Features as Current
- **Wrong**: Documenting roadmap items as completed features
- **Right**: Keep roadmap separate from current feature lists

### Rule 3: Include Context, Not Hype
- **Wrong**: "Sanitize all inputs with strict validation"
- **Better**: "API parameters validated with input sanitization"

### Rule 4: Regular Documentation Audits
- Periodic reviews required to ensure accuracy
- Flag any statements that claim perfect states
- Require code verification for all quantitative claims

### Rule 5: Use Factual Language in Commits and Chat
- **Commit Messages**: Focus on what was actually changed, not on impact or importance
- **Chat Responses**: Describe technical implementations precisely without superlatives
- **Avoid Hype Phrases**: Terms like "amazing", "incredible", "game-changing" have no place in technical communication
- **Be Specific**: Use concrete examples and references to code locations when explaining changes

### Rule 6: No Aspirational Claims Anywhere
- **Commits**: Don't claim fixes or improvements that may be partially implemented or unverified
- **Chat**: Don't promise outcomes or benefits beyond what's demonstrably true
- **Documentation**: Keep future goals separated from current capabilities
- **Verification Required**: Any claim of improvement must be backed by evidence or measurement

## Documentation File Priorities

### High Risk Areas (Must Verify)
- **README.md and Docs** - Always check claims against reality
- **Commit Messages** - Factually describe actual changes made
- **Chat Responses** - Describe implementation without hype or aspirational claims
- **docs/architecture.md** - Architecture claims frequently overstate reality
- **docs/testing.md** - Test metrics and success claims
- **docs/roadmap.md** - Must not contain false "completed" items

### CI/CD Validation Opportunity
Consider adding automated checks that:
- Verify test file counts match documented numbers
- Check if claimed UI frameworks are actually in package.json
- Flag common hype phrases for review

---

**Final Rule**: **When writing documentation, commit messages, or in chat responses, always prefer factual accuracy over marketing appeal. Claims that cannot be immediately verified against the codebase are prohibited.**
