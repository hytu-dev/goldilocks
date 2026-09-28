import { dump } from "./dump.ts";

window.__GOLDILOCKS_DEBUG = {
  dump() {
    document.querySelectorAll("goldi-break").forEach((element) => {
      const nodes = (element as any).nodes;
      const marks = (element as any).marks;
      marks ? dump(nodes, marks) : console.warn("No marks yet");
    });
  },
};
