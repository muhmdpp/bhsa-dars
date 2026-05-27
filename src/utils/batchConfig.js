// ── Batch configuration ──────────────────────────────────────────────────────
// Each batch (1–9) gets a distinct color. All class strings are written in full
// so Tailwind JIT can detect them at build time.

export const BATCH_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export const BATCH_COLORS = {
  1: {
    chip:   'bg-violet-100 text-violet-700 border border-violet-200',
    header: 'bg-violet-50 border-violet-100',
    text:   'text-violet-700',
    toggle: 'text-violet-600 hover:text-violet-800',
    dot:    'bg-violet-500',
  },
  2: {
    chip:   'bg-blue-100 text-blue-700 border border-blue-200',
    header: 'bg-blue-50 border-blue-100',
    text:   'text-blue-700',
    toggle: 'text-blue-600 hover:text-blue-800',
    dot:    'bg-blue-500',
  },
  3: {
    chip:   'bg-cyan-100 text-cyan-700 border border-cyan-200',
    header: 'bg-cyan-50 border-cyan-100',
    text:   'text-cyan-700',
    toggle: 'text-cyan-600 hover:text-cyan-800',
    dot:    'bg-cyan-500',
  },
  4: {
    chip:   'bg-emerald-100 text-emerald-700 border border-emerald-200',
    header: 'bg-emerald-50 border-emerald-100',
    text:   'text-emerald-700',
    toggle: 'text-emerald-600 hover:text-emerald-800',
    dot:    'bg-emerald-500',
  },
  5: {
    chip:   'bg-lime-100 text-lime-700 border border-lime-200',
    header: 'bg-lime-50 border-lime-100',
    text:   'text-lime-700',
    toggle: 'text-lime-600 hover:text-lime-800',
    dot:    'bg-lime-500',
  },
  6: {
    chip:   'bg-amber-100 text-amber-700 border border-amber-200',
    header: 'bg-amber-50 border-amber-100',
    text:   'text-amber-700',
    toggle: 'text-amber-600 hover:text-amber-800',
    dot:    'bg-amber-500',
  },
  7: {
    chip:   'bg-orange-100 text-orange-700 border border-orange-200',
    header: 'bg-orange-50 border-orange-100',
    text:   'text-orange-700',
    toggle: 'text-orange-600 hover:text-orange-800',
    dot:    'bg-orange-500',
  },
  8: {
    chip:   'bg-rose-100 text-rose-700 border border-rose-200',
    header: 'bg-rose-50 border-rose-100',
    text:   'text-rose-700',
    toggle: 'text-rose-600 hover:text-rose-800',
    dot:    'bg-rose-500',
  },
  9: {
    chip:   'bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200',
    header: 'bg-fuchsia-50 border-fuchsia-100',
    text:   'text-fuchsia-700',
    toggle: 'text-fuchsia-600 hover:text-fuchsia-800',
    dot:    'bg-fuchsia-500',
  },
};

/** Returns the color config for a given batch number (1–9). */
export function getBatchColors(batch) {
  return BATCH_COLORS[batch] ?? BATCH_COLORS[1];
}
