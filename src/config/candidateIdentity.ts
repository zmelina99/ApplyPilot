import 'dotenv/config';

/**
 * Candidate identity/contact facts, read ONLY from the gitignored .env (never
 * committed). A value that is empty or the literal "NEEDS_USER_INPUT" is treated as
 * unknown, so the answering engine marks the corresponding question NEEDS_INPUT rather
 * than emitting a placeholder to an employer.
 */
export interface CandidateIdentity {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
}

function val(name: string): string | null {
  const v = process.env[name]?.trim();
  if (!v || v === 'NEEDS_USER_INPUT') return null;
  return v;
}

export function loadCandidateIdentity(): CandidateIdentity {
  const city = val('CANDIDATE_CURRENT_CITY');
  const country = val('CANDIDATE_CURRENT_COUNTRY');
  const location = city || country ? [city, country].filter(Boolean).join(', ') : null;
  return {
    fullName: val('CANDIDATE_FULL_NAME'),
    email: val('CANDIDATE_EMAIL'),
    phone: val('CANDIDATE_PHONE'),
    location,
    linkedinUrl: val('CANDIDATE_LINKEDIN_URL'),
    githubUrl: val('CANDIDATE_GITHUB_URL'),
    portfolioUrl: val('CANDIDATE_PORTFOLIO_URL'),
  };
}
