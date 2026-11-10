// Valida params, query y body con esquemas zod y deja los datos limpios
// (con tipos convertidos) en req.valid. Si algo falla, el ZodError llega al
// errorHandler y se responde 400 con el detalle por campo.
// Nota: en Express 5 req.query es de solo lectura, por eso usamos req.valid.
export function validate(schemas) {
  return (req, _res, next) => {
    req.valid = {};
    for (const key of ['params', 'query', 'body']) {
      if (schemas[key]) req.valid[key] = schemas[key].parse(req[key] ?? {});
    }
    next();
  };
}
