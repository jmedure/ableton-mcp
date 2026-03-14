import type { ParamMap } from "./index.js";

export const genericMap: ParamMap = {
  deviceClassName: "_generic",
  parameters: {
    _default: {
      unit: "%",
      toHuman: (raw) => `${Math.round(raw * 100)}%`,
      fromHuman: (value) => value / 100,
    },
  },
};
