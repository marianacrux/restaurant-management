// Punto único donde se montan las rutas de cada módulo bajo /api.
// Cada módulo nuevo (auth, products, orders...) se registra aquí.
import { Router } from 'express';
import healthRoutes from '../modules/health/health.routes.js';
import authRoutes from '../modules/auth/auth.routes.js';
import categoryRoutes from '../modules/categories/category.routes.js';
import productRoutes from '../modules/products/product.routes.js';
import orderRoutes from '../modules/orders/order.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/categories', categoryRoutes);
router.use('/products', productRoutes);
router.use('/orders', orderRoutes);

export default router;
