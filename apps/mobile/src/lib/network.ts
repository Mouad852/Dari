import NetInfo from '@react-native-community/netinfo';

export async function hasNetwork(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected !== false && state.isInternetReachable !== false;
}

export function subscribeToNetwork(callback: (online: boolean) => void): () => void {
  return NetInfo.addEventListener((state) => callback(state.isConnected !== false && state.isInternetReachable !== false));
}

export function isAbortError(cause: unknown): boolean {
  return cause instanceof Error && (cause.name === 'AbortError' || cause.message === 'Aborted');
}
