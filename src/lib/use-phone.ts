"use client";

import { useEffect, useState } from "react";
import {
  isPhoneDevice,
  isPhoneViewport,
  PHONE_MAX_WIDTH,
} from "@/lib/platform";

/**
 * Detecta teléfono (viewport + UA) y mantiene body.phone sincronizado.
 * SSR: false → hidrata al montar.
 */
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(false);

  useEffect(() => {
    const update = () => {
      const on = isPhoneDevice() || isPhoneViewport();
      setPhone(on);
      document.body.classList.toggle("phone", on);
      document.body.dataset.device = on ? "phone" : "desktop";
    };
    update();

    let mql: MediaQueryList | null = null;
    try {
      mql = window.matchMedia(`(max-width: ${PHONE_MAX_WIDTH}px)`);
    } catch {
      mql = null;
    }

    const onChange = () => update();
    mql?.addEventListener?.("change", onChange);
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);

    return () => {
      mql?.removeEventListener?.("change", onChange);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
      document.body.classList.remove("phone");
      delete document.body.dataset.device;
    };
  }, []);

  return phone;
}
