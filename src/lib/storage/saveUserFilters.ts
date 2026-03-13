import type { UserFilters } from '../../types/userFilters';
import { saveUserDataOfflineFirst } from '../offlineDb/userDataWrapper';

export default async function saveUserFilters(filters: UserFilters): Promise<void> {
  await saveUserDataOfflineFirst('userFilters', filters);
}
