# Security Specification - Aunty Mercy's Corner

## 1. Data Invariants
- `DailyMessage`: Each day has a single message document in `daily_messages/{dateId}`, keyed by `YYYY-MM-DD` matching `dateString`.
- `Polaroid`: Stored in `polaroids/{polaroidId}`, must include a valid `id`, `url` (<= 1MB), `compliment` (<= 2000 chars), `date`, `userId` (`aunty-mercy-private`), and server `createdAt`.
- `Thought`: Stored in `thoughts/{thoughtId}`, must include `text` (<= 10000 chars), `userId` (`aunty-mercy-private`), and server `createdAt`.

## 2. The "Dirty Dozen" Payloads (Targets for Denial)
1. **Unregistered Path Access**: Attempt to read/write an unknown collection like `/secrets/doc1`.
2. **Identity Spoofing**: Create a `thought` or `polaroid` with a `userId` not in the allowed private ID list.
3. **ID Poisoning**: Create a `daily_messages` document with a >128 char string ID.
4. **Shadow Update**: Create or update a `thought` adding `isAdmin: true`.
5. **State Shortcut**: Update a `daily_message` without providing `updatedAt == request.time`.
6. **Resource Exhaustion**: Create a `thought` with a >10KB string in `text` or a `polaroid` with >1MB `url`.
7. **Mismatched Document Key**: Create a `daily_messages/2026-10-06` document where `dateString` is `'2026-10-05'`.
8. **Malicious Regex ID**: Use an ID with special characters outside `^[a-zA-Z0-9_\-]+$`.
9. **Timestamp Spoofing**: Create a document with a past/future `createdAt` instead of `request.time`.
10. **Immutable Field Mutation**: Update a `polaroid` attempting to mutate `userId` or `createdAt`.
11. **Unauthorized List Scrape**: List `thoughts` or `polaroids` without filtering by an allowed `userId`.
12. **Type Poisoning**: Update `daily_messages` setting `message` to a number or boolean.
