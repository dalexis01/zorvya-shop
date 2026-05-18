import { estimateDeliveryDistance, STORE_ADDRESS } from "@/helpers/delivery";
import type { AdminOrderRecord } from "@/lib/shop/admin-types";

export const TARGET_ROUTE_BLOCK_SIZE = 5;
export const MAX_PACKAGES_PER_BLOCK = 5;
export const MAX_ROUTE_BLOCKS = 10; // supports up to 50 pending delivery orders

export const AVERAGE_SPEED_KMH = 25;
export const SERVICE_MINUTES_PER_STOP = 5;

export type AdminOrderRouteStop = {
  order: AdminOrderRecord;
  stopNumber: number;
  addressLabel: string;
  areaLabel: string;
  estimatedLegKm: number;
  cumulativeKm: number;
  packages: number;
};

export type AdminOrderRouteBlock = {
  id: string;
  label: string;
  stops: AdminOrderRouteStop[];
  orders: AdminOrderRecord[];
  stopsCount: number;
  packagesCount: number;
  itemsCount: number;
  estimatedDriveKm: number;
  estimatedReturnKm: number;
  estimatedTotalKm: number;
  estimatedTimeMinutes: number;
  totalAmount: number;
  deliveryFees: number;
  areas: string[];
  routePreview: string;
  isPartial: boolean;
  isSent: boolean;
};

export type AdminOrderRoutePlan = {
  routeOrders: AdminOrderRecord[];
  routeBlocks: AdminOrderRouteBlock[];
  nonRouteOrders: AdminOrderRecord[];
  totalEstimatedKm: number;
  totalStops: number;
  totalPackages: number;
  totalItems: number;
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{Letter}\p{Number}\s,.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitAddress(address: string) {
  return address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function getAddressLabel(address: string) {
  const segments = splitAddress(address);

  if (segments.length >= 2) {
    return `${segments[0]}, ${segments[1]}`;
  }

  return segments[0] ?? address.trim() ?? "Sin direccion";
}

function getAreaLabel(address: string) {
  const segments = splitAddress(address);

  if (segments.length >= 3) {
    return segments[1];
  }

  if (segments.length >= 2) {
    return segments[1];
  }

  return segments[0] ?? "Zona sin definir";
}

function getAreaKey(address: string) {
  return normalizeText(getAreaLabel(address));
}

function tokenizeAddress(address: string) {
  return new Set(
    normalizeText(address)
      .split(/[\s,.-]+/g)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
  );
}

function countPackages(order: AdminOrderRecord) {
  const totalPackages = order.items.reduce((sum, item) => sum + item.quantity, 0);
  return Math.max(1, totalPackages);
}

function countItems(order: AdminOrderRecord) {
  return order.items.length;
}

export function estimateLegDistance(fromAddress: string, toAddress: string) {
  const normalizedFrom = normalizeText(fromAddress);
  const normalizedTo = normalizeText(toAddress);
  const normalizedStore = normalizeText(STORE_ADDRESS);

  if (!normalizedTo) {
    return 0;
  }

  if (normalizedFrom === normalizedTo) {
    return 0.4;
  }

  if (normalizedFrom === normalizedStore) {
    return estimateDeliveryDistance(toAddress);
  }

  if (normalizedTo === normalizedStore) {
    return estimateDeliveryDistance(fromAddress);
  }

  const fromArea = getAreaKey(fromAddress);
  const toArea = getAreaKey(toAddress);

  if (fromArea && fromArea === toArea) {
    return 1.8;
  }

  const fromTokens = tokenizeAddress(fromAddress);
  const toTokens = tokenizeAddress(toAddress);
  let sharedTokens = 0;

  for (const token of fromTokens) {
    if (toTokens.has(token)) {
      sharedTokens += 1;
    }
  }

  if (sharedTokens >= 2) {
    return 2.5;
  }

  if (normalizedFrom.includes("paramaribo") && normalizedTo.includes("paramaribo")) {
    return 4.2;
  }

  return 8.5;
}

function isRouteEligible(order: AdminOrderRecord) {
  return order.deliveryType === "delivery" && !order.isCancelled && !order.isCompleted;
}

function pickNextOrderIndex(remainingOrders: AdminOrderRecord[], currentAddress: string) {
  let selectedIndex = 0;

  for (let index = 1; index < remainingOrders.length; index += 1) {
    const selectedOrder = remainingOrders[selectedIndex];
    const candidateOrder = remainingOrders[index];
    const selectedDistance = estimateLegDistance(currentAddress, selectedOrder.customerAddress);
    const candidateDistance = estimateLegDistance(currentAddress, candidateOrder.customerAddress);

    if (candidateDistance < selectedDistance) {
      selectedIndex = index;
      continue;
    }

    if (candidateDistance > selectedDistance) {
      continue;
    }

    const selectedArea = getAreaKey(selectedOrder.customerAddress);
    const candidateArea = getAreaKey(candidateOrder.customerAddress);
    const currentArea = getAreaKey(currentAddress);

    if (candidateArea === currentArea && selectedArea !== currentArea) {
      selectedIndex = index;
      continue;
    }

    if (candidateArea !== currentArea && selectedArea === currentArea) {
      continue;
    }

    const candidateCreatedAt = new Date(candidateOrder.createdAt).getTime();
    const selectedCreatedAt = new Date(selectedOrder.createdAt).getTime();

    if (candidateCreatedAt < selectedCreatedAt) {
      selectedIndex = index;
      continue;
    }

    if (candidateCreatedAt === selectedCreatedAt) {
      const candidateTail = candidateOrder.idTail;
      const selectedTail = selectedOrder.idTail;

      if (candidateTail.localeCompare(selectedTail) < 0) {
        selectedIndex = index;
      }
    }
  }

  return selectedIndex;
}

function buildRouteBlock(orders: AdminOrderRecord[], blockIndex: number): AdminOrderRouteBlock {
  let currentAddress = STORE_ADDRESS;
  let cumulativeKm = 0;

  const stops = orders.map<AdminOrderRouteStop>((order, index) => {
    const estimatedLegKm = estimateLegDistance(currentAddress, order.customerAddress);
    cumulativeKm += estimatedLegKm;
    currentAddress = order.customerAddress;

    return {
      order,
      stopNumber: index + 1,
      addressLabel: getAddressLabel(order.customerAddress),
      areaLabel: getAreaLabel(order.customerAddress),
      estimatedLegKm,
      cumulativeKm,
      packages: countPackages(order),
    };
  });

  const estimatedReturnKm =
    orders.length > 0 ? estimateLegDistance(orders[orders.length - 1].customerAddress, STORE_ADDRESS) : 0;
  const areas = Array.from(new Set(stops.map((stop) => stop.areaLabel).filter(Boolean)));
  const drivingMinutes = cumulativeKm > 0 ? (cumulativeKm / AVERAGE_SPEED_KMH) * 60 : 0;
  const estimatedTimeMinutes = Math.round(drivingMinutes + stops.length * SERVICE_MINUTES_PER_STOP);

  return {
    id: `route-block-${blockIndex + 1}`,
    label: `Bloque ${String(blockIndex + 1).padStart(2, "0")}`,
    stops,
    orders,
    stopsCount: stops.length,
    packagesCount: stops.reduce((sum, stop) => sum + stop.packages, 0),
    itemsCount: orders.reduce((sum, order) => sum + countItems(order), 0),
    estimatedDriveKm: Number(cumulativeKm.toFixed(1)),
    estimatedReturnKm: Number(estimatedReturnKm.toFixed(1)),
    estimatedTotalKm: Number((cumulativeKm + estimatedReturnKm).toFixed(1)),
    estimatedTimeMinutes,
    totalAmount: Number(orders.reduce((sum, order) => sum + order.total, 0).toFixed(2)),
    deliveryFees: Number(orders.reduce((sum, order) => sum + order.deliveryFee, 0).toFixed(2)),
    areas,
    routePreview: ["Almacen", ...stops.map((stop) => stop.addressLabel), "Cierre"]
      .filter(Boolean)
      .join(" -> "),
    isPartial: orders.length < TARGET_ROUTE_BLOCK_SIZE,
    isSent: false,
  };
}

export function planAdminOrderRoutes(
  orders: AdminOrderRecord[],
  targetOrdersPerBlock: number = TARGET_ROUTE_BLOCK_SIZE,
  maxBlocks: number = MAX_ROUTE_BLOCKS
): AdminOrderRoutePlan {
  const routeOrders = orders.filter(isRouteEligible);
  const nonRouteOrders = orders.filter((order) => !isRouteEligible(order));
  const remainingOrders = [...routeOrders].sort((left, right) => {
    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });
  const routeBlocks: AdminOrderRouteBlock[] = [];

  while (remainingOrders.length > 0) {
    const nextBlockOrders: AdminOrderRecord[] = [];
    let currentAddress = STORE_ADDRESS;

    while (remainingOrders.length > 0 && nextBlockOrders.length < targetOrdersPerBlock) {
      const usedPackages = nextBlockOrders.reduce((s, o) => s + countPackages(o), 0);
      const nextIndex = pickNextOrderIndex(remainingOrders, currentAddress);
      const nextOrder = remainingOrders[nextIndex];

      if (usedPackages + countPackages(nextOrder) > MAX_PACKAGES_PER_BLOCK) break;

      remainingOrders.splice(nextIndex, 1);
      nextBlockOrders.push(nextOrder);
      currentAddress = nextOrder.customerAddress;
    }

    routeBlocks.push(buildRouteBlock(nextBlockOrders, routeBlocks.length));

    if (routeBlocks.length >= maxBlocks) {
      break;
    }
  }

  // Orders that overflowed past MAX_ROUTE_BLOCKS go to the non-route section
  const allNonRouteOrders = [...nonRouteOrders, ...remainingOrders];

  return {
    routeOrders,
    routeBlocks,
    nonRouteOrders: allNonRouteOrders,
    totalEstimatedKm: Number(
      routeBlocks.reduce((sum, block) => sum + block.estimatedTotalKm, 0).toFixed(1)
    ),
    totalStops: routeBlocks.reduce((sum, block) => sum + block.stopsCount, 0),
    totalPackages: routeBlocks.reduce((sum, block) => sum + block.packagesCount, 0),
    totalItems: routeBlocks.reduce((sum, block) => sum + block.itemsCount, 0),
  };
}
