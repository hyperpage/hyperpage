import { describe, it, expect, beforeEach } from 'vitest';
import { registerTool, toolRegistry } from '../../tools/registry';
import { Tool } from '../../tools/tool-types';

// Clear registry before each test
beforeEach(() => {
  // Reset the registry to empty state
  Object.keys(toolRegistry).forEach(key => {
    delete toolRegistry[key];
  });
});

describe('registerTool', () => {
  it('registers a tool in the registry', () => {
    const mockTool: Tool = {
      name: 'TestTool',
      slug: 'test-tool',
      enabled: true,
      ui: {
        color: 'bg-blue-500',
        icon: null,
      },
      widgets: [],
      apis: {},
      handlers: {},
      capabilities: ['test'],
    };

    registerTool('testtool', mockTool);

    expect(toolRegistry.testtool).toBe(mockTool);
  });

  it('overwrites existing tool registration', () => {
    const originalTool: Tool = {
      name: 'Original',
      slug: 'original',
      enabled: true,
      ui: { color: 'bg-blue-500', icon: null },
      widgets: [],
      apis: {},
      handlers: {},
      capabilities: [],
    };

    const updatedTool: Tool = {
      name: 'Updated',
      slug: 'updated',
      enabled: false,
      ui: { color: 'bg-green-500', icon: null },
      widgets: [],
      apis: {},
      handlers: {},
      capabilities: [],
    };

    registerTool('test', originalTool);
    registerTool('test', updatedTool);

    expect(toolRegistry.test).toBe(updatedTool);
    expect(toolRegistry.test?.enabled).toBe(false);
  });

  it('handles multiple tool registrations', () => {
    const tool1: Tool = {
      name: 'Tool1',
      slug: 'tool-1',
      enabled: true,
      ui: { color: 'bg-blue-500', icon: null },
      widgets: [],
      apis: {},
      handlers: {},
      capabilities: ['cap1'],
    };

    const tool2: Tool = {
      name: 'Tool2',
      slug: 'tool-2',
      enabled: false,
      ui: { color: 'bg-green-500', icon: null },
      widgets: [],
      apis: {},
      handlers: {},
      capabilities: ['cap2'],
    };

    registerTool('tool1', tool1);
    registerTool('tool2', tool2);

    expect(Object.keys(toolRegistry)).toHaveLength(2);
    expect(toolRegistry.tool1).toBe(tool1);
    expect(toolRegistry.tool2).toBe(tool2);
  });
});

describe('toolRegistry', () => {
  it('starts empty', () => {
    // Registry should be empty after cleanup
    expect(Object.keys(toolRegistry)).toHaveLength(0);
  });

  it('persists tools between registrations', () => {
    const tool1: Tool = {
      name: 'Tool1',
      slug: 'tool-1',
      enabled: true,
      ui: { color: 'bg-blue-500', icon: null },
      widgets: [],
      apis: {},
      handlers: {},
      capabilities: [],
    };

    const tool2: Tool = {
      name: 'Tool2',
      slug: 'tool-2',
      enabled: true,
      ui: { color: 'bg-green-500', icon: null },
      widgets: [],
      apis: {},
      handlers: {},
      capabilities: [],
    };

    registerTool('tool1', tool1);
    registerTool('tool2', tool2);

    expect(Object.keys(toolRegistry)).toHaveLength(2);
    expect(toolRegistry.tool1?.name).toBe('Tool1');
    expect(toolRegistry.tool2?.name).toBe('Tool2');
  });

  it('allows undefined tools to be registered', () => {
    // This tests edge case where undefined might be registered
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (registerTool as any)('undefinedTool', undefined);

    expect(toolRegistry.undefinedTool).toBeUndefined();
  });
});
