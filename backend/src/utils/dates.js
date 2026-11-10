// Fechas del negocio en hora de Colombia (UTC-5, sin horario de verano).
// "Hoy" para el restaurante no es "hoy" en UTC: a las 8 p. m. en Bogotá ya es mañana en UTC.
export const BUSINESS_TIMEZONE = 'America/Bogota';
const OFFSET = '-05:00';
const DAY_MS = 24 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' de hoy en Bogotá. */
export function todayLocal() {
  return new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Rango [inicio, fin) en UTC de un día local 'YYYY-MM-DD'. */
export function localDayRange(day = todayLocal()) {
  const start = new Date(`${day}T00:00:00${OFFSET}`);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/** Lista de días 'YYYY-MM-DD' entre dos fechas locales (incluidas). */
export function listLocalDays(fromDay, toDay) {
  const days = [];
  for (let t = new Date(`${fromDay}T12:00:00Z`); t <= new Date(`${toDay}T12:00:00Z`); t = new Date(t.getTime() + DAY_MS)) {
    days.push(t.toISOString().slice(0, 10));
  }
  return days;
}

export function addDays(day, n) {
  return new Date(new Date(`${day}T12:00:00Z`).getTime() + n * DAY_MS).toISOString().slice(0, 10);
}
