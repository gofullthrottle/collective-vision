/**
 * Test utilities for Cloudflare Workers testing
 */

/**
 * Create a mock HTTP request for testing
 */
export function createMockRequest(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    origin?: string;
  } = {}
): Request {
  const { method = "GET", body, headers = {}, origin = "http://localhost:3000" } = options;

  const url = `http://localhost:8787${path}`;
  const requestHeaders = new Headers({
    "Content-Type": "application/json",
    Origin: origin,
    ...headers,
  });

  const init: RequestInit = {
    method,
    headers: requestHeaders,
  };

  if (body && method !== "GET" && method !== "HEAD") {
    init.body = JSON.stringify(body);
  }

  return new Request(url, init);
}

/**
 * Parse JSON response body
 */
export async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Failed to parse response as JSON: ${text}`);
  }
}

/**
 * Assert that a response matches expected status and body structure
 */
export async function assertResponse<T>(
  response: Response,
  expected: {
    status?: number;
    contentType?: string;
  }
): Promise<T> {
  if (expected.status !== undefined) {
    if (response.status !== expected.status) {
      const body = await response.text();
      throw new Error(
        `Expected status ${expected.status}, got ${response.status}. Body: ${body}`
      );
    }
  }

  if (expected.contentType !== undefined) {
    const contentType = response.headers.get("content-type");
    if (!contentType?.includes(expected.contentType)) {
      throw new Error(
        `Expected content-type to include "${expected.contentType}", got "${contentType}"`
      );
    }
  }

  return parseResponse<T>(response);
}

/**
 * Test fixture for creating workspace and board
 */
export const testFixtures = {
  workspace: {
    slug: "test-workspace",
    name: "Test Workspace",
  },
  board: {
    slug: "main",
    name: "Main Board",
  },
  feedback: {
    title: "Test feedback item",
    description: "This is a test feedback description",
    externalUserId: "test-user-123",
  },
};
