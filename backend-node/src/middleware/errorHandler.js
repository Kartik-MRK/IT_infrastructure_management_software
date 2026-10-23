/**
 * 404 Not Found Handler matching Flask API contract: { "error": "Endpoint not found" }
 */
export const notFoundHandler = (_req, res) => {
  return res.status(404).json({ error: 'Endpoint not found' });
};

/**
 * Centralized Error Handler matching Flask API contract: { "error": "Internal server error" }
 */
export const errorHandler = (err, _req, res, _next) => {
  // Handle JSON parse errors from express.json()
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  // Handle Zod validation errors
  if (err?.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.errors,
    });
  }

  // Generic 500
  console.error('Unhandled server error:', err);
  return res.status(err.status || 500).json({
    error: err.message && process.env.NODE_ENV === 'test' ? err.message : 'Internal server error',
  });
};
