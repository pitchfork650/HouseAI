/** Practice details stay literal placeholders until the clinic fills them in. */
export const PRACTICE = {
  doctorName: "Dr. [NAME]",
  doctorShort: "DR. [NAME]",
  practiceName: "[PRACTICE NAME]",
  fromAddress: "care@[practice].com",
  phone: "[PHONE]",
  signedInInitials: "DR",
};

/** Default records each nav item opens. */
export const DEFAULT_ROUTES = {
  diagnostics: "/diagnostics/P-1042",
  insurance: "/insurance/P-1091",
  followUp: "/follow-ups/FU-1077",
};

export function isMockMode(): boolean {
  return !process.env.GEMINI_API_KEY;
}
