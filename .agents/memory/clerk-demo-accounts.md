---
name: Clerk demo accounts
description: Development-only demo users must be provisioned through the managed Clerk tenant, not through a local authentication shortcut.
---

Use server-side Clerk user provisioning for development demo accounts so the accounts exercise the same sign-in and session behavior as real users. Clerk rejects placeholder email domains such as `.test`; use valid email-shaped domains and keep demo credentials out of source files and persistent agent memory.

**Why:** A local login bypass would diverge from the production auth path, while invalid placeholder domains prevent Clerk from creating usable demo users.

**How to apply:** When demo users are requested, create them only in the development Clerk tenant, seed matching app profiles if needed, and communicate the credentials directly to the user rather than committing them.