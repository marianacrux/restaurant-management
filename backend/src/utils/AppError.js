// Error de negocio con código HTTP. Los servicios lanzan AppError y el
// middleware errorHandler lo convierte en una respuesta JSON uniforme.
export class AppError extends Error {
  constructor(message, statusCode = 400, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
  }

  static badRequest(message, details) {
    return new AppError(message, 400, details);
  }

  static unauthorized(message = 'No autenticado') {
    return new AppError(message, 401);
  }

  static forbidden(message = 'No tiene permisos para esta acción') {
    return new AppError(message, 403);
  }

  static notFound(message = 'Recurso no encontrado') {
    return new AppError(message, 404);
  }

  static conflict(message, details) {
    return new AppError(message, 409, details);
  }
}
