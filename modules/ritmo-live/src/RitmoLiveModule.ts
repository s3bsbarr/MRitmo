import { NativeModule, requireOptionalNativeModule } from 'expo';

export type LiveDiagnosis = {
  sdk: number;
  manufacturer: string;
  /** User/system allows Live Updates for Ritmo (Android 16+); null below 16. */
  canPost: boolean | null;
  /** The last timer notification met every Live Update requirement. */
  promotable: boolean | null;
  /** A timer notification is showing right now. */
  active: boolean;
  /** The system actually promoted it (FLAG_PROMOTED_ONGOING). */
  promoted: boolean | null;
};

declare class RitmoLiveModule extends NativeModule<{}> {
  start(title: string, endsAt: number, totalMs: number): void;
  pause(title: string, remainingMs: number, totalMs: number): void;
  stop(): void;
  diagnose(): LiveDiagnosis;
  openPromotionSettings(): void;
}

/** Null on web and in Expo Go, where the native code is not compiled in. */
export default requireOptionalNativeModule<RitmoLiveModule>('RitmoLive');
