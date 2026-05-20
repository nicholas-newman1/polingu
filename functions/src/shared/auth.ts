export async function isAdmin(userId: string): Promise<boolean> {
  const { getAuth } = await import('firebase-admin/auth');
  try {
    const user = await getAuth().getUser(userId);
    return !!user.customClaims?.admin;
  } catch {
    return false;
  }
}
