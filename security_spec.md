# CineFlix Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants & Master Source of Truth

1. **Master Gate & Relational Ownership**:
   - `/users/{userId}` is the root identity document for each authenticated user (`request.auth.uid == userId`).
   - Every subcollection document under `/users/{userId}/watchlist/{itemId}` and `/users/{userId}/history/{itemId}` MUST verify:
     1. The authenticated user has `request.auth.uid == userId` and `request.auth.token.email_verified == true`.
     2. The parent user document `/users/$(userId)` exists (`exists(/databases/$(database)/documents/users/$(userId))`) so orphaned sub-resources can never be created without an active parent user profile.
     3. The payload's `userId` field strictly matches `request.auth.uid` and `userId`.
2. **PII Isolation**:
   - `/users/{userId}` stores the user's `email`, `displayName`, `photoURL`, and `bio`. Read (`get`) and write (`create`, `update`, `delete`) access is strictly restricted to the document owner (`request.auth.uid == userId`). Blanket `list` or `isSignedIn()` reads on `/users` are strictly prohibited.
3. **Strict Schema, Key Allowlisting & Volumetric Bounds**:
   - Every string field enforces explicit `.size()` bounds matching `firebase-blueprint.json`.
   - Every array field (`favoriteGenres`, `genreIds`) enforces `.size() <= 10` and validates element type (`size() == 0 || array[0] is int`).
   - All timestamps (`createdAt`, `updatedAt`) must equal `request.time`.
   - Immutable fields (`uid`, `userId`, `email`, `tmdbId`, `mediaType`, `createdAt`) cannot be modified during `update`.
   - `allow list` on subcollections (`/users/{userId}/watchlist` and `/users/{userId}/history`) explicitly checks `request.auth.uid == userId && resource.data.userId == request.auth.uid`.

---

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Payload 1 (Identity Spoofing on Profile Create)**:
   Authenticated as `user_A`, attempting to create `/users/user_A` with `{ uid: "user_B", ... }` -> **REJECTED (`PERMISSION_DENIED`)**.
2. **Payload 2 (Unverified Email Write)**:
   Authenticated as `user_A` with `email_verified: false`, attempting to create `/users/user_A` -> **REJECTED (`PERMISSION_DENIED`)**.
3. **Payload 3 (Cross-User PII Read)**:
   Authenticated as `user_B`, attempting `get /users/user_A` -> **REJECTED (`PERMISSION_DENIED`)**.
4. **Payload 4 (Shadow Field / Ghost Property Injection)**:
   Authenticated as `user_A`, attempting to update `/users/user_A` with `{ isAdmin: true, displayName: "Alex", updatedAt: request.time }` -> **REJECTED (`PERMISSION_DENIED`)** via `hasOnly()`.
5. **Payload 5 (Immortal Field Mutation on Profile Update)**:
   Authenticated as `user_A`, attempting to mutate `createdAt` or `uid` on `/users/user_A` -> **REJECTED (`PERMISSION_DENIED`)**.
6. **Payload 6 (Client Timestamp Forgery)**:
   Authenticated as `user_A`, sending a past/future `createdAt` or `updatedAt` timestamp != `request.time` -> **REJECTED (`PERMISSION_DENIED`)**.
7. **Payload 7 (Orphaned Subcollection Write)**:
   Authenticated as `user_NoProfile`, attempting to create `/users/user_NoProfile/watchlist/movie_550` when `/users/user_NoProfile` does not exist -> **REJECTED (`PERMISSION_DENIED`)** via Master Gate `exists()`.
8. **Payload 8 (Denial-of-Wallet String Overflow)**:
   Authenticated as `user_A`, attempting to create a watchlist item with a 10,000-character `overview` (> 1000 max) -> **REJECTED (`PERMISSION_DENIED`)**.
9. **Payload 9 (Unbounded Array Poisoning)**:
   Authenticated as `user_A`, attempting to set `favoriteGenres` with 50 elements (> 10 max) or string elements instead of integers -> **REJECTED (`PERMISSION_DENIED`)**.
10. **Payload 10 (Invalid MediaType Enum)**:
    Authenticated as `user_A`, attempting to create `/users/user_A/watchlist/item_1` with `mediaType: "podcast"` -> **REJECTED (`PERMISSION_DENIED`)**.
11. **Payload 11 (Path ID Poisoning)**:
    Authenticated as `user_A`, attempting to create a watchlist doc with malicious path ID containing spaces/slashes or > 128 chars -> **REJECTED (`PERMISSION_DENIED`)** via `isValidId()`.
12. **Payload 12 (Unauthorized Subcollection List Scraping)**:
    Authenticated as `user_B`, attempting `list /users/user_A/watchlist` -> **REJECTED (`PERMISSION_DENIED`)**.
