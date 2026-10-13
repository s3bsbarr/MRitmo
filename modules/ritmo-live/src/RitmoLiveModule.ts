import { NativeModule, requireOptionalNativeModule } from 'expo';

declare class RitmoLiveModule extends NativeModule<{}> {
  start(title: string, endsAt: number): void;
  pause(title: string, remainingMs: number): void;
  stop(): void;
  canPromote(): boolean;
}

/** Null on web and in Expo Go, where the native code is not compiled in. */
export default requireOptionalNativeModule<RitmoLiveModule>('RitmoLive');
