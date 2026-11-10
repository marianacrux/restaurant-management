import { Router } from 'express';
import { validate } from '../../middlewares/validate.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { idParamSchema } from '../../utils/validation.js';
import {
  addItemsSchema,
  changeStatusSchema,
  createOrderSchema,
  listOrdersQuerySchema,
  updateOrderSchema,
} from './order.validator.js';
import * as controller from './order.controller.js';

const router = Router();
const byId = { params: idParamSchema };

router.use(authenticate); // todas las rutas de pedidos requieren sesión

// Consulta: personal operativo (el domiciliario verá sus entregas en /deliveries).
router.get('/', authorize('ADMIN', 'CAJERO', 'COCINA'), validate({ query: listOrdersQuerySchema }), controller.list);
router.get('/:id', authorize('ADMIN', 'CAJERO', 'COCINA'), validate(byId), controller.getById);
router.get('/:id/history', authorize('ADMIN', 'CAJERO', 'COCINA'), validate(byId), controller.history);

// Registro manual (POS, vitrina, domicilio telefónico). El bot usará el mismo servicio.
router.post('/', authorize('ADMIN', 'CAJERO'), validate({ body: createOrderSchema }), controller.create);
router.patch('/:id', authorize('ADMIN', 'CAJERO'), validate({ ...byId, body: updateOrderSchema }), controller.update);
router.post('/:id/items', authorize('ADMIN', 'CAJERO'), validate({ ...byId, body: addItemsSchema }), controller.addItems);

// Los permisos finos por estado se validan en el servicio (ROLE_ALLOWED_TARGETS).
router.patch('/:id/status', authorize('ADMIN', 'CAJERO', 'COCINA'), validate({ ...byId, body: changeStatusSchema }), controller.changeStatus);

export default router;
