import { redirect } from 'next/navigation';

/**
 * Dari takes no payments: rent is settled between the people concerned. This
 * route used to be a placeholder with a "Sécurisé" badge and disabled buttons,
 * which implied a feature the product does not have. Old links land on the
 * account hub instead of a 404.
 */
export default function AccountPaymentsPage(): never {
  redirect('/account');
}
