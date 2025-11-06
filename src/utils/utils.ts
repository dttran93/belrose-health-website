import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const removeUndefinedValues = <T extends Record<string, any>>(obj: T): Partial<T> => {
    return Object.fromEntries(
        Object.entries(obj).filter(([_, value]) => value !== undefined)
    ) as Partial<T>;
};