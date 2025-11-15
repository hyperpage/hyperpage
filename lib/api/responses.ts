import { NextResponse } from "next/server";

export type ApiErrorResponseOptions = {
  status?: number;
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
  headers?: Record<string, string>;
};

const DEFAULT_ERROR_MESSAGE = "An error occurred while processing the request";
const DEFAULT_ERROR_CODE = "INTERNAL_SERVER_ERROR";

export function createErrorResponse(
  options: ApiErrorResponseOptions = {},
): NextResponse {
  const {
    status = 500,
    code = DEFAULT_ERROR_CODE,
    message = DEFAULT_ERROR_MESSAGE,
    details,
    headers,
  } = options;

  const body: Record<string, unknown> = {
    success: false,
    error: {
      code,
      message,
    },
  };

  if (details !== undefined) {
    body.details = details;
  }

  return NextResponse.json(body, {
    status,
    headers,
  });
}

export function methodNotAllowedResponse(
  allowedMethods: string[],
): NextResponse {
  return createErrorResponse({
    status: 405,
    code: "METHOD_NOT_ALLOWED",
    message: "Method not allowed",
    headers: {
      Allow: allowedMethods.join(", "),
    },
  });
}

export function validationErrorResponse(
  message = "Invalid request",
  code = "INVALID_REQUEST",
  details?: Record<string, unknown>,
): NextResponse {
  return createErrorResponse({
    status: 400,
    code,
    message,
    details,
  });
}
