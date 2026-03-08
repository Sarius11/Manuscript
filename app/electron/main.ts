export interface MainBootstrapResult {
  started: boolean;
  message: string;
}

export function bootstrapMain(): MainBootstrapResult {
  return {
    started: false,
    message: "Step 1 placeholder. Electron window bootstrapping starts in Step 2."
  };
}
