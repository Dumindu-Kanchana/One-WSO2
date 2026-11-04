// DEMO ONLY (demo/par-2 branch): the PAR-only demo build, on when
// window.config.DEMO_PAR_ONLY is true. Only the PAR backend is configured, so
// the shell shows PAR alone, opens on it, and takes the viewer's profile from
// the persona they act as (devActAs) instead of the people backend.
import type { Employee, UserInfo } from "@features/my/api/types";
import { devActAs, isParOnlyDemo } from "./devActAs";

export { isParOnlyDemo };

/** Where the demo opens, and where Me's own pages send you. */
export const DEMO_HOME = "/me/performance";

/** The rail entries the demo keeps: PAR under Me, and Lead/Admin/OKRs under People Ops. */
export const DEMO_RAIL_IDS: ReadonlySet<string> = new Set([
  "par",
  "par-employee-feedback",
  "people-par",
  "par-lead-portal",
  "par-admin-portal",
  "par-okrs",
]);

/** The perspectives the app switcher offers in the demo. */
export const DEMO_PERSPECTIVE_KEYS: ReadonlySet<string> = new Set(["me", "people"]);

function personaName(): { firstName: string; lastName: string } {
  const name = (devActAs()?.label ?? "Demo viewer").split(" · ")[0];
  const [firstName, ...rest] = name.split(" ");
  return { firstName, lastName: rest.join(" ") };
}

/** The viewer's /user-info in the demo: the persona's. */
export function demoUserInfo(): UserInfo & { workLocation: string | null } {
  return {
    id: 0,
    employeeId: devActAs()?.email ?? "",
    ...personaName(),
    workEmail: devActAs()?.email ?? "",
    employeeThumbnail: null,
    designation: null,
    privileges: [],
    workLocation: null,
  };
}

/** The viewer's employee record in the demo: only what the PAR screens read. */
export function demoEmployee(): Employee {
  return {
    employeeId: devActAs()?.email ?? "",
    ...personaName(),
    workEmail: devActAs()?.email ?? "",
    employeeThumbnail: null,
    employmentType: "PERMANENT",
  } as unknown as Employee;
}
