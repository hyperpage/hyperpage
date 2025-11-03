# Documentation Guidelines - Hyperpage

This document outlines the documentation maintenance standards and practices for the Hyperpage project.

## .clinerules Organization

The `.clinerules/` directory contains focused rule files organized by domain for better discoverability and maintenance:

- **[`.clinerules/coding-principles.md`](.clinerules/coding-principles.md)** - Core architectural principles and widget/tool integration patterns
- **[`.clinerules/coding-style.md`](.clinerules/coding-style.md)** - Code standards, TypeScript usage, and Next.js patterns
- **[`.clinerules/security-practices.md`](.clinerules/security-practices.md)** - Security standards, API token management, and validation requirements
- **[`.clinerules/configuration-guidelines.md`](.clinerules/configuration-guidelines.md)** - Configuration management, environment setup, and tool addition workflow
- **[`.clinerules/avoid-marketing-hype.md`](.clinerules/avoid-marketing-hype.md)** - Documentation accuracy rules and anti-hype guidelines
- **[`.clinerules/documentation-guidelines.md`](.clinerules/documentation-guidelines.md)** - Documentation maintenance and this file
- **[`.clinerules/workflows/`](./workflows/)** - Executable Cline workflows for common development tasks

## Rule File Maintenance Guidelines

### When to Add New Rule Files

Add new rule files when introducing major new domains or categories that require dedicated guidance:

- New architectural paradigms (e.g., new deployment patterns would go in a new file)
- Major new domains not covered by existing files (e.g., testing strategies, performance monitoring)
- Significant process changes requiring dedicated documentation

### When to Update Existing Rule Files

Update existing rule files for:

- **coding-principles.md**: New architectural patterns, widget requirements, tool integration changes
- **coding-style.md**: Code style updates, new framework guidelines, component patterns
- **security-practices.md**: Security improvements, new validation requirements, audit findings
- **configuration-guidelines.md**: New tool additions, environment setup changes, security updates
- **documentation-guidelines.md**: Changes to documentation processes or this file

### Cross-Reference Requirements

Rule files should reference other files for clear separation of concerns:

- Link to `security-practices.md` when discussing authentication or validation
- Reference `configuration-guidelines.md` for tool setup and environment configuration
- Cite `coding-principles.md` for architectural design decisions

## Documentation Updates

### README.md Integration

- Update the Contributing section when adding or renaming rule files
- Document new features, tool integrations, or architectural changes
- Update configuration sections when adding new tools or environment variables
- Maintain the `.clinerules/` directory overview with accurate links

### Project Documentation

- **Tool Integration System**: Maintain `docs/tool-integration-system.md` as the comprehensive guide for tool architecture, adding new integrations, and examples
- **Roadmap**: Keep `docs/roadmap.md` current for development planning and features
- **Component Documentation**: Major components should include inline JSDoc comments for complex logic

### Version Control Practices

- Rule files should be committed to version control for team access
- Use meaningful commit messages for documentation changes
- Keep README.md references synchronized with `.clinerules/` file changes
- Maintain "as-of" dates in roadmap-style documents when applicable

## Quality Standards

### Content Organization

- Use consistent heading hierarchy and formatting
- Include clear bullet points and numbered lists for procedures
- Provide practical examples in code blocks where helpful
- Maintain consistent terminology across rule files

### Maintenance Responsibilities

- **Architectural Changes**: Update `coding-principles.md` for new patterns or integrations
- **Security Updates**: Immediately update `security-practices.md` for new requirements
- **Tool Additions**: Update both `configuration-guidelines.md` and `coding-principles.md`
- **Code Style Changes**: Update `coding-style.md` for new standards or best practices

By following these guidelines, the project's documentation remains organized, current, and discoverable for all contributors.
