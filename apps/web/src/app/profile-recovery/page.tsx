import { legalRelease } from '@/lib/legal';

import { ProfileRecoveryForm } from './ProfileRecoveryForm';

/** Server side only to read the legal pages' version (DARI_LEGAL_VERSION), which the form records as accepted. */
export default function ProfileRecoveryPage() {
  return <ProfileRecoveryForm termsVersion={legalRelease.version} />;
}
