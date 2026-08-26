export const pretolerance = 100;
export const tolerance = 200;

export const line_penalty = 10;
export const hyphen_penalty = 50;
export const ex_hyphen_penalty = 50;

export const double_hyphen_demerits = 10000;
export const final_hyphen_demerits = 5000;
export const adj_demerits = 10000;

const inf_bad = 10000;

export function badness(deficit: number, stretch: number): number {
  if (deficit === 0) return 0;
  if (stretch === 0) return inf_bad;
  const ratio = (() => {
    if (deficit <= 7230584) return Math.floor((deficit * 297) / stretch);
    if (stretch >= 1663497) return Math.floor(deficit / Math.floor(stretch / 297));
    return deficit;
  })();
  return ratio > 1290 ? inf_bad : Math.floor((ratio ** 3 + 131072) / 262144);
}

export const very_loose_fit = 0;
export const loose_fit = 1;
export const decent_fit = 2;

export function fitness(badness: number): number {
  return badness > 99 ? very_loose_fit : badness > 12 ? loose_fit : decent_fit;
}
