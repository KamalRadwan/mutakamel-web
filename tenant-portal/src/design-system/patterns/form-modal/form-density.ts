import { createContext } from "react";

/** React context also reaches sections rendered inside Radix portals. */
export const FormDensityContext = createContext<"standard" | "compact">("standard");
