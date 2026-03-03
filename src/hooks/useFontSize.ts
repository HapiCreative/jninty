import { useEffect } from "react";
import type { Settings } from "../validation/settings.schema.ts";

const FONT_SIZES: Record<NonNullable<Settings["fontSize"]>, string> = {
  normal: "16px",
  large: "18px",
  "extra-large": "20px",
};

export function useFontSize(fontSize: Settings["fontSize"]) {
  useEffect(() => {
    document.documentElement.style.fontSize = FONT_SIZES[fontSize ?? "normal"];
  }, [fontSize]);
}
