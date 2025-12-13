/// <reference path="../.astro/types.d.ts" />

import type { User } from "./server/db/schema";

declare global {
  namespace App {
    interface Locals {
      user: User | null;
    }
  }
}

export {};
