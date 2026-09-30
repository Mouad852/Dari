/**
 * Field limits and per-field API errors (audit P1-4).
 *
 * The API refuses a string over its DTO limit with a 400 whose `fields` maps
 * the field to a French message ("120 caractères maximum"). Capping the input
 * at the same length stops the typing where the server would refuse, and
 * `fieldErrors` hands a form those messages to show on each field instead of
 * the bare "Données invalides".
 */

import { ApiError } from './api';

/** The API's @Size limits, by the form field they cap. */
export const MAX_LENGTH = {
  listingTitle: 120,
  listingCity: 80,
  listingNeighborhood: 80,
  listingDescription: 2000,
  displayName: 60,
  firstName: 60,
  profileCity: 60,
  bio: 600,
  message: 4000,
  // Sign-up builds the display name as "Prénom Nom", capped at 60: 30 + a space + 29.
  signUpFirstName: 30,
  signUpLastName: 29,
} as const;

/** The 400's per-field messages, keyed as the API sent them; empty for any other failure. */
export function fieldErrors(error: unknown): Record<string, string> {
  return error instanceof ApiError && error.fields ? error.fields : {};
}
