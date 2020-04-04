export default interface ServiceConnection {
  setupAuth(): Promise<void>;
  cleanupAuth(): Promise<void>;
}