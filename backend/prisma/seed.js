// Datos iniciales del demo. Es idempotente: puede ejecutarse varias veces
// sin duplicar registros (usa upsert / búsqueda previa).
// Uso (desde backend/):  npm run db:seed
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SEED_PASSWORD = process.env.SEED_USER_PASSWORD;
if (!SEED_PASSWORD || SEED_PASSWORD.length < 8) {
  console.error('❌ Defina SEED_USER_PASSWORD (mín. 8 caracteres) en backend/.env');
  process.exit(1);
}

const USERS = [
  { name: 'Administrador', email: 'admin@restaurante.test', role: 'ADMIN' },
  { name: 'Carla Cajera', email: 'cajero@restaurante.test', role: 'CAJERO' },
  { name: 'Cocina Principal', email: 'cocina@restaurante.test', role: 'COCINA' },
  { name: 'Diego Domiciliario', email: 'domiciliario@restaurante.test', role: 'DOMICILIARIO' },
];

const CATEGORIES = [
  { name: 'Platos fuertes', description: 'Almuerzos y platos principales', position: 1 },
  { name: 'Hamburguesas', description: 'Hamburguesas artesanales', position: 2 },
  { name: 'Combos', description: 'Combinaciones con descuento', position: 3 },
  { name: 'Bebidas', description: 'Bebidas frías y calientes', position: 4 },
  { name: 'Adicionales', description: 'Acompañamientos y extras', position: 5 },
  { name: 'Postres', description: 'Dulces y postres', position: 6 },
];

// Precios en pesos colombianos (COP).
const PRODUCTS = [
  { name: 'Bandeja paisa', category: 'Platos fuertes', price: 28000, isDailyMenu: true, isFeatured: true, description: 'Frijoles, arroz, chicharrón, carne molida, huevo, maduro y arepa' },
  { name: 'Almuerzo ejecutivo', category: 'Platos fuertes', price: 18000, isDailyMenu: true, description: 'Sopa del día, seco, jugo natural y postre' },
  { name: 'Pechuga a la plancha', category: 'Platos fuertes', price: 22000, isDailyMenu: true, description: 'Con arroz, ensalada y papas a la francesa' },
  { name: 'Sobrebarriga en salsa', category: 'Platos fuertes', price: 26000, available: false, description: 'Con papa salada y arroz (AGOTADO para pruebas)' },
  { name: 'Hamburguesa clásica', category: 'Hamburguesas', price: 19000, isDailyMenu: true, isFeatured: true, description: 'Carne 150 g, queso, lechuga, tomate y salsa de la casa' },
  { name: 'Hamburguesa doble', category: 'Hamburguesas', price: 25000, description: 'Doble carne, doble queso y tocineta' },
  { name: 'Hamburguesa de pollo', category: 'Hamburguesas', price: 18000, description: 'Pollo apanado, queso y vegetales' },
  { name: 'Combo clásico', category: 'Combos', price: 26000, isFeatured: true, description: 'Hamburguesa clásica + papas + gaseosa' },
  { name: 'Combo familiar', category: 'Combos', price: 72000, description: '3 hamburguesas + papas grandes + gaseosa 1.5 L' },
  { name: 'Gaseosa 400 ml', category: 'Bebidas', price: 4000 },
  { name: 'Jugo natural', category: 'Bebidas', price: 6000, description: 'Mora, lulo, maracuyá o mango' },
  { name: 'Limonada de coco', category: 'Bebidas', price: 8000 },
  { name: 'Agua 600 ml', category: 'Bebidas', price: 3000 },
  { name: 'Papas a la francesa', category: 'Adicionales', price: 6000 },
  { name: 'Porción de arroz', category: 'Adicionales', price: 3000 },
  { name: 'Tajadas de maduro', category: 'Adicionales', price: 4000 },
  { name: 'Tres leches', category: 'Postres', price: 8000 },
  { name: 'Brownie con helado', category: 'Postres', price: 9000 },
];

const DELIVERY_PERSONS = [
  { name: 'Diego Domiciliario', phone: '3001110001', transportType: 'MOTOCICLETA', userEmail: 'domiciliario@restaurante.test' },
  { name: 'Andrés Gómez', phone: '3001110002', transportType: 'MOTOCICLETA' },
  { name: 'Laura Ríos', phone: '3001110003', transportType: 'BICICLETA' },
  { name: 'Julián Pérez', phone: '3001110004', transportType: 'MOTOCICLETA' },
  { name: 'Sofía Martínez', phone: '3001110005', transportType: 'A_PIE' },
  { name: 'Camilo Torres', phone: '3001110006', transportType: 'BICICLETA', availability: 'INACTIVO' },
];

const SCREENS = [
  { screenNumber: 1, name: 'Menú del día', description: 'Productos, fotografías, precios y disponibilidad' },
  { screenNumber: 2, name: 'Promociones y combos', description: 'Promociones activas, combos y descuentos' },
  { screenNumber: 3, name: 'Bebidas y complementos', description: 'Bebidas, adicionales y complementos' },
  { screenNumber: 4, name: 'Publicidad y destacados', description: 'Productos destacados y anuncios' },
];

const SETTINGS = [
  { key: 'DELIVERY_FEE', value: '5000' },
  { key: 'RESTAURANT_NAME', value: 'Restaurante Demo' },
];

async function seedUsers() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  for (const u of USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, passwordHash, active: true },
      create: { ...u, passwordHash },
    });
  }
  console.log(`✔ ${USERS.length} usuarios`);
}

async function seedCatalog() {
  const categoryIds = {};
  for (const c of CATEGORIES) {
    const cat = await prisma.category.upsert({ where: { name: c.name }, update: c, create: c });
    categoryIds[c.name] = cat.id;
  }

  for (const { category, ...p } of PRODUCTS) {
    const data = { available: true, isDailyMenu: false, isFeatured: false, ...p, categoryId: categoryIds[category] };
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (existing) await prisma.product.update({ where: { id: existing.id }, data });
    else await prisma.product.create({ data });
  }
  console.log(`✔ ${CATEGORIES.length} categorías, ${PRODUCTS.length} productos`);
}

async function seedPromotions() {
  const combo = await prisma.product.findFirst({ where: { name: 'Combo clásico' } });
  const today = new Date();
  const inThirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const promos = [
    { name: 'Martes de hamburguesa', description: '20% de descuento en hamburguesas los martes', discountType: 'PORCENTAJE', discountValue: 20 },
    { name: 'Combo clásico a precio especial', description: 'Ahorra $4.000 en el combo clásico', discountType: 'VALOR_FIJO', discountValue: 4000, productId: combo?.id },
  ];
  for (const p of promos) {
    const data = { ...p, startDate: today, endDate: inThirtyDays, active: true };
    const existing = await prisma.promotion.findFirst({ where: { name: p.name } });
    if (existing) await prisma.promotion.update({ where: { id: existing.id }, data });
    else await prisma.promotion.create({ data });
  }
  console.log(`✔ ${promos.length} promociones`);
}

async function seedDeliveryPersons() {
  for (const { userEmail, ...d } of DELIVERY_PERSONS) {
    const user = userEmail ? await prisma.user.findUnique({ where: { email: userEmail } }) : null;
    const data = { availability: 'DISPONIBLE', ...d, userId: user?.id ?? null };
    await prisma.deliveryPerson.upsert({ where: { phone: d.phone }, update: data, create: data });
  }
  console.log(`✔ ${DELIVERY_PERSONS.length} domiciliarios`);
}

async function seedScreensAndSettings() {
  for (const s of SCREENS) {
    await prisma.menuScreen.upsert({ where: { screenNumber: s.screenNumber }, update: s, create: s });
  }
  for (const s of SETTINGS) {
    await prisma.setting.upsert({ where: { key: s.key }, update: {}, create: s }); // no pisa cambios del admin
  }
  console.log(`✔ ${SCREENS.length} pantallas, ${SETTINGS.length} parámetros`);
}

try {
  await seedUsers();
  await seedCatalog();
  await seedPromotions();
  await seedDeliveryPersons();
  await seedScreensAndSettings();
  console.log('🌱 Seed completado');
} catch (error) {
  console.error('❌ Error en el seed:', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
