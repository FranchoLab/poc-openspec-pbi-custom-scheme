export const requiredPbiFields = [
  { id: "user-story", heading: "User Story" },
  { id: "context", heading: "Context" },
  { id: "scope", heading: "Scope" },
  { id: "acceptance-criteria", heading: "Acceptance Criteria" },
  { id: "related-documentation", heading: "Related Documentation" },
  { id: "constraints", heading: "Constraints" },
  { id: "out-of-scope", heading: "Out of Scope" },
] as const;

export type PbiFieldId = (typeof requiredPbiFields)[number]["id"];