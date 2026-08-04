/* §13.2 step 1.15 — one bank, every trade.

   The bank was mined from a dental template, so six of its 71 paragraphs say
   "dental", "dentists" or "teeth". The 17 real reports cover chiropractic and
   dermatology too, and in those the same paragraph appears with the wording
   swapped — "chiro IQ" rather than "dental IQ". That is one paragraph with a
   variable in it, not two paragraphs.

   Keeping it as a variable matters beyond tidiness: a snippet is 20-80's IP and
   the bank test asserts every one traces back to the source template. Forking
   per-trade copies would triple the wording to maintain and let the versions
   drift apart, which is exactly how a house style stops being one. */

export interface Profession {
  /** Adjective before a noun: "the {{profession_adj}} service content". */
  adj: string
  /** Plural people: "no photos of the actual {{practitioners}}". */
  practitioners: string
  /** What a patient searches when something is wrong, not what it is called. */
  condition_examples: string
  /** A named treatment for a campaign example. */
  treatment_example: string
}

/* Keyed by the same term `practiceKeyword()` searches Google for, so the trade
   used to find competitors and the trade used to write the report cannot
   disagree with each other. */
export const PROFESSIONS: Record<string, Profession> = {
  dentist: {
    adj: 'dental',
    practitioners: 'dentists',
    condition_examples: 'toothache or missing teeth',
    treatment_example: 'Teeth Whitening',
  },
  orthodontist: {
    adj: 'orthodontic',
    practitioners: 'orthodontists',
    condition_examples: 'crooked teeth or an overbite',
    treatment_example: 'Invisalign',
  },
  chiropractor: {
    adj: 'chiropractic',
    practitioners: 'chiropractors',
    condition_examples: 'back pain or sciatica',
    treatment_example: 'Spinal Health Checks',
  },
  dermatologist: {
    adj: 'dermatology',
    practitioners: 'dermatologists',
    condition_examples: 'acne or a suspicious mole',
    treatment_example: 'Skin Cancer Checks',
  },
  physiotherapist: {
    adj: 'physiotherapy',
    practitioners: 'physiotherapists',
    condition_examples: 'a sports injury or ongoing knee pain',
    treatment_example: 'Injury Assessments',
  },
  podiatrist: {
    adj: 'podiatry',
    practitioners: 'podiatrists',
    condition_examples: 'heel pain or an ingrown toenail',
    treatment_example: 'Custom Orthotics',
  },
  veterinarian: {
    adj: 'veterinary',
    practitioners: 'vets',
    condition_examples: 'a limping dog or a cat off its food',
    treatment_example: 'Dental Checks for Pets',
  },
}

/** Falls back to dental, which is both the template's trade and the commonest. */
export function professionFor(keyword: string): Profession {
  return PROFESSIONS[keyword] ?? PROFESSIONS.dentist
}
