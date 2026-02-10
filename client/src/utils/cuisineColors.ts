/**
 * Cuisine color mapping for visual variety indicators
 * Returns subtle background colors and border colors for each cuisine
 */

const CUISINE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  Italian: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900' },
  Mexican: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-900' },
  Chinese: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-900' },
  Japanese: { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-900' },
  Thai: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-900' },
  Indian: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900' },
  French: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900' },
  Greek: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-900' },
  Spanish: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-900' },
  Korean: { bg: 'bg-fuchsia-50', border: 'border-fuchsia-200', text: 'text-fuchsia-900' },
  Vietnamese: { bg: 'bg-lime-50', border: 'border-lime-200', text: 'text-lime-900' },
  American: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-900' },
  Mediterranean: { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-900' },
  'Middle Eastern': { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900' },
  Caribbean: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-900' },
  German: { bg: 'bg-stone-50', border: 'border-stone-200', text: 'text-stone-900' },
  British: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-900' },
};

export const getCuisineColors = (cuisine: string | null | undefined) => {
  if (!cuisine) return { bg: 'bg-accent/50', border: 'border-accent', text: 'text-foreground' };
  return CUISINE_COLORS[cuisine] || { bg: 'bg-accent/50', border: 'border-accent', text: 'text-foreground' };
};

