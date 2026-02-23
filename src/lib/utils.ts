import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function getStockStatus(currentQty: number, velocity: number, leadTime: number = 14): {
  status: 'critical' | 'low' | 'watch' | 'good' | 'overstock';
  daysOfStock: number;
  label: string;
  color: string;
} {
  if (currentQty === 0) {
    return { status: 'critical', daysOfStock: 0, label: 'Out of Stock', color: 'text-red-600 bg-red-50' };
  }
  
  const daysOfStock = velocity > 0 ? Math.round(currentQty / velocity) : 999;
  
  if (daysOfStock < 7) {
    return { status: 'critical', daysOfStock, label: 'Critical', color: 'text-red-600 bg-red-50' };
  } else if (daysOfStock < leadTime) {
    return { status: 'low', daysOfStock, label: 'Low Stock', color: 'text-orange-600 bg-orange-50' };
  } else if (daysOfStock < leadTime * 2) {
    return { status: 'watch', daysOfStock, label: 'Watch', color: 'text-yellow-600 bg-yellow-50' };
  } else if (daysOfStock > 180) {
    return { status: 'overstock', daysOfStock, label: 'Overstock', color: 'text-blue-600 bg-blue-50' };
  }
  
  return { status: 'good', daysOfStock, label: 'Good', color: 'text-green-600 bg-green-50' };
}
