import { legalRelease } from '@/lib/legal';

import { SignUpForm } from './SignUpForm';

/** Server side only to read the legal pages' version (DARI_LEGAL_VERSION), which the form records as accepted. */
export default function SignUpPage() {
  return <SignUpForm termsVersion={legalRelease.version} />;
}
