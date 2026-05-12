"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { HomepageSettings } from "@/lib/shop/admin-types";
import type { StorefrontProduct } from "@/lib/shop/types";

type StorefrontState = {
  products: StorefrontProduct[];
  settings: HomepageSettings | null;
  setProducts: (products: StorefrontProduct[]) => void;
  setSettings: (settings: HomepageSettings) => void;
};

const safeSessionStorage = {
  getItem(name: string) {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      return window.sessionStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem(name: string, value: string) {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.sessionStorage.setItem(name, value);
    } catch {
      return;
    }
  },
  removeItem(name: string) {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.sessionStorage.removeItem(name);
    } catch {
      return;
    }
  },
};

export const useStorefrontStore = create<StorefrontState>()(
  persist(
    (set) => ({
      products: [],
      settings: null,
      setProducts: (products) => set({ products }),
      setSettings: (settings) => set({ settings }),
    }),
    {
      name: "zorvya-storefront-cache-v2",
      storage: createJSONStorage(() => safeSessionStorage),
      partialize: (state) => ({
        products: state.products,
        settings: state.settings,
      }),
    }
  )
);
