// DEMO ONLY (demo/par-2 branch): lets the PAR screens act as one of the demo's
// made-up people. Personas come from window.config.DEV_AS_PERSONAS.
//
// Against a local PAR backend, which decodes the bearer token without verifying
// it, PAR calls carry a token naming the persona. Against the deployed demo
// backend, the real sign-in token stays (the gateway checks it) and the persona
// goes in the x-demo-act-as header, which that backend honours only for its own
// list of personas. Every other backend gets the real sign-in untouched.
//
// The deployed demo (DEMO_PAR_ONLY) always acts as someone, since the people
// signing in aren't in its data: DEMO_DEFAULT_PERSONA until switched. The one
// in use is remembered in this browser.
import { parBackendUrl } from "@config/apiConfig";

export interface DevPersona {
  label: string;
  email: string;
  groups: string[];
}

interface DemoConfig {
  DEV_AS_PERSONAS?: DevPersona[];
  DEMO_DEFAULT_PERSONA?: string;
  DEMO_PAR_ONLY?: boolean;
}

const demoConfig = () => (window.config ?? {}) as unknown as DemoConfig;

const STORAGE_KEY = "par-dev-act-as";

function isLocalParBackend(): boolean {
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(parBackendUrl);
}

/** The deployed PAR-only demo: PAR screens only, always as a persona. */
export function isParOnlyDemo(): boolean {
  return demoConfig().DEMO_PAR_ONLY === true;
}

export function devPersonas(): DevPersona[] {
  if (!isLocalParBackend() && !isParOnlyDemo()) return [];
  return demoConfig().DEV_AS_PERSONAS ?? [];
}

export function devActAs(): DevPersona | null {
  const personas = devPersonas();
  let email: string | null = null;
  try {
    email = localStorage.getItem(STORAGE_KEY);
  } catch {
    // No storage: the default below.
  }
  const chosen = personas.find((p) => p.email === email);
  if (chosen) return chosen;
  if (!isParOnlyDemo()) return null;
  return personas.find((p) => p.email === demoConfig().DEMO_DEFAULT_PERSONA) ?? personas[0] ?? null;
}

export function setDevActAs(email: string | null) {
  try {
    if (email) localStorage.setItem(STORAGE_KEY, email);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // No storage: nothing to switch.
  }
  window.location.reload();
}

// The token a call to the local PAR backend carries instead of the real one,
// or the real one for anything else.
export function devActAsToken(url: string, realToken: string): string {
  const persona = devActAs();
  if (!persona || !isLocalParBackend() || !url.startsWith(parBackendUrl)) return realToken;
  const encode = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ email: persona.email, groups: persona.groups })}.local-demo`;
}

// The persona header a call to the deployed demo backend carries.
export function devActAsHeaders(url: string): Record<string, string> {
  const persona = devActAs();
  if (!persona || isLocalParBackend() || !url.startsWith(parBackendUrl)) return {};
  return { "x-demo-act-as": persona.email };
}
