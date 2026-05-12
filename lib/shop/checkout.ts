export const PICKUP_ADDRESS = "Anton Drachtenweg 146";

const PICKUP_TIMES = [
  ["09:00", "9:00 AM"],
  ["10:00", "10:00 AM"],
  ["11:00", "11:00 AM"],
  ["12:00", "12:00 PM"],
  ["13:00", "1:00 PM"],
  ["14:00", "2:00 PM"],
  ["15:00", "3:00 PM"],
  ["16:00", "4:00 PM"],
  ["17:00", "5:00 PM"],
] as const;

export const PICKUP_TIME_OPTIONS = PICKUP_TIMES.map(([value, label]) => ({
  value,
  label,
}));

function startOfDay(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function sameDay(left: Date, right: Date) {
  return startOfDay(left).getTime() === startOfDay(right).getTime();
}

function pickupTimeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return Number.NaN;
  }
  return hours * 60 + minutes;
}

export function isWeekday(date: Date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

export function getMaxPickupDate(baseDate = new Date()) {
  const maxDate = startOfDay(baseDate);
  maxDate.setDate(maxDate.getDate() + 7);
  return maxDate;
}

export function toPickupDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parsePickupDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

export function formatPickupLabel(pickupDate: string, pickupTime: string) {
  const date = parsePickupDateKey(pickupDate);
  const option = PICKUP_TIME_OPTIONS.find((item) => item.value === pickupTime);

  if (!date || !option) {
    return "";
  }

  return `${date.toLocaleDateString()} ${option.label}`;
}

export function getPickupValidationError(
  pickupDate: string | null | undefined,
  pickupTime: string | null | undefined,
  now = new Date()
) {
  if (!pickupDate || !pickupTime) {
    return "Debe seleccionar una fecha y una hora de recogida.";
  }

  const parsedDate = parsePickupDateKey(pickupDate);
  if (!parsedDate) {
    return "La fecha de recogida no es válida.";
  }

  if (!isWeekday(parsedDate)) {
    return "La recogida solo está disponible de lunes a viernes.";
  }

  const today = startOfDay(now);
  const maxDate = getMaxPickupDate(now);

  if (parsedDate.getTime() < today.getTime()) {
    return "La fecha de recogida no puede ser anterior a hoy.";
  }

  if (parsedDate.getTime() > maxDate.getTime()) {
    return "La recogida solo puede programarse hasta 7 días por delante.";
  }

  const slot = PICKUP_TIME_OPTIONS.find((option) => option.value === pickupTime);
  if (!slot) {
    return "La hora de recogida no es válida.";
  }

  if (sameDay(parsedDate, now)) {
    const selectedMinutes = pickupTimeToMinutes(pickupTime);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    if (selectedMinutes < currentMinutes) {
      return "La hora seleccionada ya ha pasado.";
    }
  }

  return null;
}
