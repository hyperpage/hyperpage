---
description: Guidelines to prevent marketing hype and false metrics in documentation
author: Generated from documentation cleanup task
version: 1.0
tags: ["documentation", "marketing", "accuracy", "technical-writing"]
severity: "high"
---

# Documentation Accuracy: Avoid Marketing Hype and False Metrics

## Critical Rule: No False Claims in Documentation

**MANDATORY INSTRUCTION**: All documentation, README.md, and architectural descriptions **MUST** accurately reflect the current state of the codebase. No marketing hype, aspirational claims, or false metrics are allowed.

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

## Documentation File Priorities

### High Risk Files (Must Verify)
- **README.md** - Always check claims against reality
- **docs/architecture.md** - Architecture claims frequently overstate reality
- **docs/testing.md** - Test metrics and success claims
- **docs/roadmap.md** - Must not contain false "completed" items

### CI/CD Validation Opportunity
Consider adding automated checks that:
- Verify test file counts match documented numbers
- Check if claimed UI frameworks are actually in package.json
- Flag common hype phrases for review

---

**Final Rule**: **When writing documentation, always prefer factual accuracy over marketing appeal. Claims that cannot be immediately verified against the codebase are prohibited.**
