// Node module-loader hook: lets us run the real edge function (which imports
// supabase-js from an https://esm.sh URL, as Deno does) under Node by pointing
// that URL at a local stand-in.
const STUB = new URL('./supabaseStub.mjs', import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('https://esm.sh/@supabase/supabase-js')) {
    return { url: STUB, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
