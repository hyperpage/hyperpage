---
name: "TODO Management Implementation for Task Organization"
description: "Implementation details for TODO list management and task tracking"
author: "Hyperpage Team"
version: "2.0"
tags: ["todo", "implementation", "automation", "task-management"]
globs: ["docs/TODO.md"]
---

# TODO List Management - Implementation Guide

This document provides implementation details for applying task management within the Hyperpage project, focusing on TODO list management and task tracking.

## TODO List Management Rules 📋

### **MUST FOLLOW - Automatic TODO List Management**

**CRITICAL RULE**: The system **automatically manages todo lists** to help track task progress:

1. **ONLY BEFORE complex tasks** (15+ minutes of work): Create comprehensive checklists
2. **10th API request trigger**: Review and update existing todo list if present
3. **Mode switch trigger**: Create comprehensive todo list when switching to ACT MODE
4. **Silent updates**: Todo list updates done silently using task_progress parameter - **NO announcements**
5. **Markdown format ONLY**: Standard format `- [ ]` for incomplete, `- [x]` for completed
6. **Actionable steps**: Focus on meaningful progress milestones rather than granular technical details
7. **Simple tasks**: Short checklists with even a single item are acceptable

### **📊 Just-In-Time Creation Strategy**

- **DEFAULT**: Do NOT create todo lists for routine, quick tasks (<5 minutes)
- **CONTEXT**: Create comprehensive roadmap only before starting complex work requiring >15 minutes
- **SILENCE**: User does not need to be announced when creating/updating - this is operational

### **🔥 Ultimate Simplicity Principle**

**docs/TODO.md** **MUST ONLY contain detailed tasks to do**. **NEVER** include:

- ❌ **No project overviews or introductions**
- ❌ **No completion summaries or achievements**  
- ❌ **No "mission accomplished" sections**
- ❌ **No status reports or marketing language**
- ❌ **No category headers or section breaks**

**✅ ONLY**:

```
- [ ] Task description - Detailed explanation of what needs to be done
- [ ] Another task - Specific actionable item with context
```

**This is the ultimate clean todo list format - nothing more, nothing less.**

## Hyperpage-Specific Implementation

### File Location
- **Primary File**: `docs/TODO.md`
- **Automatic Updates**: Via `task_progress` parameter in tool calls
- **Format**: Pure markdown with checkbox syntax

### Integration Points
- **Plan Mode**: Use `task_progress` to create preliminary roadmaps
- **Act Mode**: Update progress as tasks are completed
- **Tool Calls**: Every significant tool use should update TODO status
- **Mode Switching**: Create comprehensive lists when transitioning to Act Mode

### Quality Standards for TODO Items
1. **Specific**: Each item describes exactly what needs to be done
2. **Measurable**: Progress can be clearly tracked
3. **Actionable**: Starts with an action verb
4. **Contextual**: Includes relevant file paths or component names
5. **Atomic**: Single, complete task (no partial completion)

### Example TODO Structure
```markdown
- [ ] Analyze existing authentication flow
- [ ] Design OAuth integration patterns
- [ ] Implement GitHub OAuth handler
- [ ] Test OAuth callback routing
- [ ] Update security documentation
- [ ] Validate token storage mechanisms
```

## Implementation Dependencies

### Depends On
- **Task Management Principles**: Applies task organization to TODO management specifically
- **Progress Tracking**: Implements automatic list management patterns

### Extends
- **Core Methodology**: Applies task management principles to TODO tracking specifically
- **Automation Guidelines**: Implements automatic list management patterns

## Validation Checklist

Before creating or updating TODO lists:
- [ ] Follows the "ultimate simplicity principle" (no extra content)
- [ ] Items are atomic and specific
