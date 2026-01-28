export default function getFirstName(displayName: string | null, email: string | null): string {
  if (displayName) {
    return displayName.split(' ')[0];
  }
  if (email) {
    return email.split('@')[0];
  }
  return '';
}
