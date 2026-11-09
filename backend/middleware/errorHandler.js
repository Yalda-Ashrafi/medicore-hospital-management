function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  let status = error.statusCode || error.status || 500;
  let message = status >= 500 && !error.isOperational ? "Internal server error" : error.message || "Request failed";

  if (error.name === "ValidationError") {
    status = 400;
    message = Object.values(error.errors).map((item) => item.message).join(", ");
  } else if (error.name === "CastError") {
    status = 400;
    message = "Invalid resource identifier";
  } else if (error.type === "entity.parse.failed" || error instanceof SyntaxError && error.status === 400) {
    status = 400;
    message = "Malformed JSON request body";
  } else if (error.code === 11000) {
    status = 400;
    message = `${Object.keys(error.keyValue || {})[0] || "Value"} already exists`;
  }

  if (status >= 500 && !error.isOperational) console.error(error);
  res.status(status).json({ success: false, message });
}

module.exports = { notFound, errorHandler };
