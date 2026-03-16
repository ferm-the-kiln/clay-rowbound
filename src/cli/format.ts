import pc from "picocolors";

export const success = (s: string) => pc.green(s);
export const error = (s: string) => pc.red(s);
export const warn = (s: string) => pc.yellow(s);
export const dim = (s: string) => pc.dim(s);
export const bold = (s: string) => pc.bold(s);
