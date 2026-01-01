/**
 * MCP Tool Registry
 * Registers and manages all available MCP tools
 */

import type { MCPToolDefinition, ToolHandler, MCPContext, MCPEnv, JsonRpcError } from '../types';
import { MCP_ERROR_CODES } from '../types';
import { requirePermission } from '../auth';

// Query tools
import { listFeedback, LIST_FEEDBACK_DEFINITION } from './query/list-feedback';
import { getFeedback, GET_FEEDBACK_DEFINITION } from './query/get-feedback';
import { searchFeedback, SEARCH_FEEDBACK_DEFINITION } from './query/search-feedback';
import { getThemes, GET_THEMES_DEFINITION } from './query/get-themes';
import { getTrends, GET_TRENDS_DEFINITION } from './query/get-trends';
import { getStatistics, GET_STATISTICS_DEFINITION } from './query/get-statistics';

// Write tools
import { submitFeedback, SUBMIT_FEEDBACK_DEFINITION } from './write/submit-feedback';
import { voteFeedback, VOTE_FEEDBACK_DEFINITION } from './write/vote-feedback';
import { addComment, ADD_COMMENT_DEFINITION } from './write/add-comment';
import { updateStatus, UPDATE_STATUS_DEFINITION } from './write/update-status';

// Tool registration
interface RegisteredTool {
  definition: MCPToolDefinition;
  handler: ToolHandler;
  requiredPermission: 'read' | 'write';
}

const tools: Map<string, RegisteredTool> = new Map();

// Register all tools
function registerTool(
  definition: MCPToolDefinition,
  handler: ToolHandler,
  permission: 'read' | 'write'
): void {
  tools.set(definition.name, { definition, handler, requiredPermission: permission });
}

// Query tools (read permission)
registerTool(LIST_FEEDBACK_DEFINITION, listFeedback, 'read');
registerTool(GET_FEEDBACK_DEFINITION, getFeedback, 'read');
registerTool(SEARCH_FEEDBACK_DEFINITION, searchFeedback, 'read');
registerTool(GET_THEMES_DEFINITION, getThemes, 'read');
registerTool(GET_TRENDS_DEFINITION, getTrends, 'read');
registerTool(GET_STATISTICS_DEFINITION, getStatistics, 'read');

// Write tools (write permission)
registerTool(SUBMIT_FEEDBACK_DEFINITION, submitFeedback, 'write');
registerTool(VOTE_FEEDBACK_DEFINITION, voteFeedback, 'write');
registerTool(ADD_COMMENT_DEFINITION, addComment, 'write');
registerTool(UPDATE_STATUS_DEFINITION, updateStatus, 'write');

/**
 * Get all tool definitions
 */
export function getToolDefinitions(): MCPToolDefinition[] {
  return Array.from(tools.values()).map(t => t.definition);
}

/**
 * Get a specific tool by name
 */
export function getTool(name: string): RegisteredTool | undefined {
  return tools.get(name);
}

/**
 * Execute a tool by name
 */
export async function executeTool(
  name: string,
  params: Record<string, unknown>,
  context: MCPContext,
  env: MCPEnv
): Promise<{ result: unknown } | { error: JsonRpcError }> {
  const tool = tools.get(name);

  if (!tool) {
    return {
      error: {
        code: MCP_ERROR_CODES.METHOD_NOT_FOUND,
        message: `Unknown tool: ${name}`,
        data: { available_tools: Array.from(tools.keys()) },
      },
    };
  }

  // Check permission
  const permError = requirePermission(context, tool.requiredPermission);
  if (permError) {
    return { error: permError };
  }

  // Validate required parameters
  const validationError = validateParams(params, tool.definition);
  if (validationError) {
    return { error: validationError };
  }

  try {
    const result = await tool.handler(params, context, env);
    return { result };
  } catch (err) {
    console.error(`Tool execution error [${name}]:`, err);
    return {
      error: {
        code: MCP_ERROR_CODES.INTERNAL_ERROR,
        message: err instanceof Error ? err.message : 'Tool execution failed',
      },
    };
  }
}

/**
 * Validate parameters against tool schema
 */
function validateParams(
  params: Record<string, unknown>,
  definition: MCPToolDefinition
): JsonRpcError | null {
  const { properties, required = [] } = definition.inputSchema;

  // Check required parameters
  for (const req of required) {
    if (!(req in params) || params[req] === undefined || params[req] === null) {
      return {
        code: MCP_ERROR_CODES.INVALID_PARAMS,
        message: `Missing required parameter: ${req}`,
        data: { required, provided: Object.keys(params) },
      };
    }
  }

  // Type validation
  for (const [key, value] of Object.entries(params)) {
    const propDef = properties[key];
    if (!propDef) continue; // Extra params are ignored

    const expectedType = propDef.type;
    const actualType = Array.isArray(value) ? 'array' : typeof value;

    // Basic type checking
    if (expectedType === 'string' && actualType !== 'string') {
      return {
        code: MCP_ERROR_CODES.INVALID_PARAMS,
        message: `Parameter '${key}' must be a string`,
      };
    }
    if (expectedType === 'number' && actualType !== 'number') {
      return {
        code: MCP_ERROR_CODES.INVALID_PARAMS,
        message: `Parameter '${key}' must be a number`,
      };
    }
    if (expectedType === 'boolean' && actualType !== 'boolean') {
      return {
        code: MCP_ERROR_CODES.INVALID_PARAMS,
        message: `Parameter '${key}' must be a boolean`,
      };
    }
    if (expectedType === 'array' && !Array.isArray(value)) {
      return {
        code: MCP_ERROR_CODES.INVALID_PARAMS,
        message: `Parameter '${key}' must be an array`,
      };
    }

    // Enum validation
    if (propDef.enum && !propDef.enum.includes(value as string)) {
      return {
        code: MCP_ERROR_CODES.INVALID_PARAMS,
        message: `Parameter '${key}' must be one of: ${propDef.enum.join(', ')}`,
        data: { value, allowed: propDef.enum },
      };
    }

    // Number range validation
    if (actualType === 'number') {
      if (propDef.minimum !== undefined && (value as number) < propDef.minimum) {
        return {
          code: MCP_ERROR_CODES.INVALID_PARAMS,
          message: `Parameter '${key}' must be >= ${propDef.minimum}`,
        };
      }
      if (propDef.maximum !== undefined && (value as number) > propDef.maximum) {
        return {
          code: MCP_ERROR_CODES.INVALID_PARAMS,
          message: `Parameter '${key}' must be <= ${propDef.maximum}`,
        };
      }
    }
  }

  return null;
}
