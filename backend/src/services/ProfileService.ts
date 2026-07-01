import type { UpdateProfileRequest, UserProfile } from '@daemonai/shared';
import * as repo from '../db/repository';
import { DEFAULT_FRAMEWORK_ID, getFramework } from '../frameworks/registry';
import { HttpError } from '../lib/http';

/** Legt das Profil beim ersten Zugriff an – Cognito ist die Quelle für E-Mail. */
export async function ensureProfile(userId: string, email: string): Promise<UserProfile> {
  const existing = await repo.getProfile(userId);
  if (existing) return existing;

  const profile: UserProfile = {
    userId,
    email,
    locale: 'de',
    framework: DEFAULT_FRAMEWORK_ID,
    settings: { theme: 'system' },
    createdAt: new Date().toISOString(),
  };
  await repo.putProfile(profile);
  return profile;
}

export async function updateProfile(
  userId: string,
  email: string,
  patch: UpdateProfileRequest
): Promise<UserProfile> {
  if (patch.framework && !getFramework(patch.framework)) {
    throw new HttpError(400, `Unbekanntes Framework: ${patch.framework}`);
  }
  const profile = await ensureProfile(userId, email);
  const updated: UserProfile = {
    ...profile,
    framework: patch.framework ?? profile.framework,
    locale: patch.locale ?? profile.locale,
    settings: { ...profile.settings, ...patch.settings },
  };
  await repo.putProfile(updated);
  return updated;
}
