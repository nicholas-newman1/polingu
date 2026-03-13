import type { UserFilters } from '../../types/userFilters';
import { saveUserData } from '../offlineDb/userDataWrapper';

export default async function saveUserFilters(filters: UserFilters): Promise<void> {
  await saveUserData('userFilters', filters);
}
