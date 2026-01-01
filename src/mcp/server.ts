/**
 * MCP Server Handler
 * Main entry point for MCP protocol requests
 */

import type {
  JsonRpcRequest,
  JsonRpcResponse,
  MCPDiscoveryResponse,
  MCPEnv,
} from './types';
import { MCP_ERROR_CODES } from './types';
import { extractApiKey, validateApiKey } from './auth';
import { getToolDefinitions, executeTool } from './tools';

const MCP_VERSION = '1.0.0';
const MCP_NAME = 'collective-vision-mcp';
const MCP_DESCRIPTION = 'MCP server for Collective Vision feedback platform. Query, search, and manage user feedback with AI-powered analysis.';

/**
 * Handle MCP discovery endpoint
 */
function handleDiscovery(): MCPDiscoveryResponse {
  return {
    name: MCP_NAME,
    version: MCP_VERSION,
    description: MCP_DESCRIPTION,
    tools: getToolDefinitions(),
    authentication: {
      type: 'api_key',
      header: 'Authorization',
      description: 'Use "Bearer cv_mcp_xxx" format or include api_key in tool parameters',
    },
  };
}

/**
 * Parse JSON-RPC request
 */
function parseRequest(body: string): JsonRpcRequest | null {
  try {
    const parsed = JSON.parse(body);

    // Validate JSON-RPC 2.0 structure
    if (parsed.jsonrpc !== '2.0' || !parsed.method || !parsed.id) {
      return null;
    }

    return parsed as JsonRpcRequest;
  } catch {
    return null;
  }
}

/**
 * Create JSON-RPC success response
 */
function successResponse(id: string | number, result: unknown): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}

/**
 * Create JSON-RPC error response
 */
function errorResponse(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown
): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      data,
    },
  };
}

/**
 * Main MCP request handler
 */
export async function handleMcpRequest(
  request: Request,
  env: MCPEnv
): Promise<Response> {
  const url = new URL(request.url);

  // Handle discovery endpoint
  if (url.pathname === '/mcp/.well-known/mcp.json' || url.pathname === '/mcp/discover') {
    return new Response(JSON.stringify(handleDiscovery(), null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // Only accept POST for main MCP endpoint
  if (request.method !== 'POST') {
    return new Response(JSON.stringify(errorResponse(null, MCP_ERROR_CODES.INVALID_REQUEST, 'Method not allowed')), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Allow': 'POST',
      },
    });
  }

  // Parse request body
  let body: string;
  try {
    body = await request.text();
  } catch {
    return new Response(JSON.stringify(errorResponse(null, MCP_ERROR_CODES.PARSE_ERROR, 'Failed to read request body')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const jsonRpcRequest = parseRequest(body);
  if (!jsonRpcRequest) {
    return new Response(JSON.stringify(errorResponse(null, MCP_ERROR_CODES.PARSE_ERROR, 'Invalid JSON-RPC request')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id, method, params = {} } = jsonRpcRequest;

  // Handle standard MCP methods
  switch (method) {
    case 'initialize':
      return jsonResponse(successResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: MCP_NAME,
          version: MCP_VERSION,
        },
      }));

    case 'tools/list':
      return jsonResponse(successResponse(id, {
        tools: getToolDefinitions(),
      }));

    case 'tools/call': {
      // Extract tool name and arguments
      const toolName = params.name as string;
      const toolArgs = (params.arguments || {}) as Record<string, unknown>;

      if (!toolName) {
        return jsonResponse(errorResponse(id, MCP_ERROR_CODES.INVALID_PARAMS, 'Missing tool name'));
      }

      // Authenticate
      const apiKey = extractApiKey(request, toolArgs);
      if (!apiKey) {
        return jsonResponse(errorResponse(id, MCP_ERROR_CODES.UNAUTHORIZED, 'Missing API key'));
      }

      const authResult = await validateApiKey(apiKey, env);
      if ('error' in authResult) {
        return jsonResponse(errorResponse(id, authResult.error.code, authResult.error.message, authResult.error.data));
      }

      // Execute tool
      const result = await executeTool(toolName, toolArgs, authResult.context, env);

      if ('error' in result) {
        return jsonResponse(errorResponse(id, result.error.code, result.error.message, result.error.data));
      }

      return jsonResponse(successResponse(id, {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result.result, null, 2),
          },
        ],
      }));
    }

    case 'ping':
      return jsonResponse(successResponse(id, { pong: true }));

    default:
      return jsonResponse(errorResponse(id, MCP_ERROR_CODES.METHOD_NOT_FOUND, `Unknown method: ${method}`));
  }
}

/**
 * Create JSON response with proper headers
 */
function jsonResponse(data: JsonRpcResponse): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
