import { BaseUser } from "./user";

export interface Revision {
  description: string;
  id: number;
  is_creation: boolean;
  is_reversion: boolean;
  message?: string | null;
  user: BaseUser;
  diff: { before: Record<string, unknown>; after: Record<string, unknown> };
  timestamp: string;
}
