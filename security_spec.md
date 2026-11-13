# DYNOSHI Android Lab — Security Specification (Zero-Trust Firestore Rules)

## 1. Core Data Invariants
1. **Master Gate Ownership**: Every operator resource (`devices`, `diagnostics`, `aiThreads`, `messages`) lives strictly beneath `/users/{userId}` and requires `/users/{userId}` to exist for single-document subcollection operations, with `ownerId == request.auth.uid` verified on every document.
2. **Verified Authentication**: All client mutations (`create`, `update`, `delete`) require `request.auth != null && request.auth.token.email_verified == true`.
3. **No Self-Assigned Roles**: On `/users/{userId}` creation, `role` MUST be `'operator'` and cannot be escalated to `'admin'` by the client.
4. **No PII Exposure**: Public/list reads across `/users` are completely blocked (`allow list: if false;`), and `/users/{userId}` omits email/phone/address fields and restricts `get` strictly to `request.auth.uid == userId`.
5. **Strict Schema & Volumetric Bounds**: Every document enforces `keys().hasAll(...)` and `keys().hasOnly(...)` on create, action-based `affectedKeys().hasOnly(...)` on update, strict `.size()` limits on all strings and bounded arrays (`<= 10`), and regex `^[a-zA-Z0-9_\-]+$` on all path IDs.
6. **Temporal & Identity Integrity**: `createdAt == request.time` on create, `updatedAt == request.time` on create/update, and `ownerId`/`createdAt`/`uid`/`id`/`threadId` remain immutable after creation.

## 2. "Dirty Dozen" Adversarial Attack Payloads (All Must Yield `PERMISSION_DENIED`)
1. **Unauthenticated Read/Write**: Any operation with `request.auth == null`.
2. **Cross-Tenant Device Injection**: Signed-in user `uidA` tries `create` at `/users/uidB/devices/dev1` or sets `ownerId: "uidB"` inside `/users/uidA/devices/dev1`.
3. **Unverified Email Bypass**: Signed-in user with `email_verified: false` tries to create a diagnostic snapshot or AI thread.
4. **Shadow/Ghost Field Injection**: Payload at `/users/uidA/devices/dev1` includes extra unknown key `isVerified: true` or `adminOverride: true`.
5. **Self-Privilege Escalation**: Creating `/users/uidA` with `role: "admin"` instead of `"operator"`.
6. **ID Poisoning**: Creating `/users/uidA/devices/invalid$id;drop` or a 1,500-character document ID (`!isValidId`).
7. **Denial-of-Wallet String Bloat**: Submitting an `AiMessage` with `text` > 32,000 chars or `AiThread.title` > 160 chars.
8. **Unbounded Array / Type Spoofing**: Submitting `AiMessage` with `sourceUrls` containing 11 items or `[12345]` (non-string index 0).
9. **Client Timestamp Forgery**: Creating a `DiagnosticSnapshot` with `createdAt: "2020-01-01T00:00:00Z"` instead of `serverTimestamp()` (`request.time`).
10. **Immutable Field Mutation**: Updating an existing `DeviceRecord` while modifying `ownerId` or `createdAt`.
11. **Orphaned Subcollection Write**: Creating `/users/uidA/aiThreads/missingThread/messages/m1` when parent `/users/uidA/aiThreads/missingThread` does not exist.
12. **Blanket Collection Scrape**: Attempting `list` on `/users` or `/users/uidB/diagnostics` without matching `request.auth.uid == userId && resource.data.ownerId == request.auth.uid`.
