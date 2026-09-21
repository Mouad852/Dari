const required = ['EXPO_PUBLIC_FIREBASE_API_KEY', 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', 'EXPO_PUBLIC_FIREBASE_PROJECT_ID'] as const;

export function configErrors(): string[] {
  return required.filter((name) => !process.env[name]?.trim()).map((name) => `Configuration mobile manquante : ${name}`);
}
