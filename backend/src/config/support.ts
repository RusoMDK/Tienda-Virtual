// src/config/support.ts

// Horario laboral L–V 9–18 (ajusta a gusto)
export const BUSINESS_HOURS = {
  start: 9, // 09:00
  end: 18, // 18:00
  days: [1, 2, 3, 4, 5] as const, // L-V (0=Dom, 6=Sáb)
};

// SLAs en minutos de *tiempo laboral*
export const SLA = {
  firstResponseMins: 60, // 1h hábil
  resolutionMins: 24 * 60, // 24h hábiles
};

/**
 * Avanza n minutos SOLO dentro de horario laboral.
 * - Si la fecha inicial está fuera de horario, salta al próximo inicio laboral.
 * - Omite fines de semana / días no laborables definidos en BUSINESS_HOURS.days
 */
export function addBusinessMinutes(from: Date, mins: number) {
  const { start, end, days } = BUSINESS_HOURS;
  if (mins <= 0) return new Date(from);

  const isWorkingDay = (dt: Date) => days.includes(dt.getDay() as any);
  const isWorkingTime = (dt: Date) => {
    if (!isWorkingDay(dt)) return false;
    const h = dt.getHours() + dt.getMinutes() / 60;
    return h >= start && h < end;
  };

  const nextStart = (dt: Date) => {
    const out = new Date(dt);
    out.setSeconds(0, 0);
    // Si es día laboral pero antes de start → set start hoy.
    const wd = out.getDay();
    const h = out.getHours() + out.getMinutes() / 60;
    if (isWorkingDay(out) && h < start) {
      out.setHours(start, 0, 0, 0);
      return out;
    }
    // Si no es día laboral o ya pasó end → avanza al próximo día laboral a start
    while (!isWorkingDay(out) || h >= end) {
      out.setDate(out.getDate() + 1);
      out.setHours(start, 0, 0, 0);
      // recomputa h/wd para el siguiente loop
      const nh = out.getHours() + out.getMinutes() / 60;
      if (isWorkingDay(out) && nh >= start && nh < end) break;
    }
    return out;
  };

  let remaining = mins;
  let cur = isWorkingTime(from) ? new Date(from) : nextStart(from);

  while (remaining > 0) {
    const blockEnd = new Date(cur);
    blockEnd.setHours(end, 0, 0, 0);

    const canUse = Math.min(
      remaining,
      Math.max(0, (blockEnd.getTime() - cur.getTime()) / 60000)
    );

    if (canUse <= 0) {
      // saltar al próximo inicio laboral
      cur = nextStart(new Date(blockEnd.getTime() + 60_000));
      continue;
    }

    // consumir bloque
    remaining -= canUse;
    cur = new Date(cur.getTime() + canUse * 60_000);

    if (remaining > 0) {
      // pasar al próximo inicio laboral
      cur = nextStart(cur);
    }
  }

  return cur;
}
