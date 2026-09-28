// biome-ignore lint/correctness/noUnusedVariables: augmenting global Window
interface Window {
  __enableGoldilocksDebug?: () => Promise<typeof import("./debug/init.ts")>;
  __GOLDILOCKS_DEBUG?: {
    dump: typeof import("./debug/dump.ts").dump;
    scan: typeof import("./debug/scan.ts").scan;
  };
}
