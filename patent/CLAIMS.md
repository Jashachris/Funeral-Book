Informal Claim Set — Priority / Draft Claims

These are informal, prioritized claims to guide counsel when drafting formal claims for a non-provisional application. They are for discussion and should be refined by a patent attorney.

1. A server-based social platform comprising: a pluggable persistence adapter configured to select between a WASM-based SQL engine and a file-backed JSON store; a privacy module that supports private user accounts and follow-request approval; and a server-sent event subsystem that broadcasts room-based messages with per-recipient block filtering.

2. The platform of claim 1, wherein the persistence adapter automatically migrates existing JSON store contents into a SQL table when the WASM-based SQL engine is initialized.

3. The platform of claim 1, further comprising moderation endpoints that allow users to file categorized reports and administrators to suspend and resolve accounts, and wherein moderation actions are recorded within the persistence adapter.

4. The platform of claim 1, wherein the server-sent events subsystem associates each active connection with an authenticated user identifier and filters broadcast messages so that recipients who have blocked the sender do not receive those messages.

5. The platform of claim 1, further comprising a share utility that launches a local server instance and exposes it via a tunnel provider to create a temporarily public endpoint for demonstrations.

6. The platform of claim 1, wherein the privacy module enforces visibility of posts such that posts from private accounts are visible only to approved followers.

7. The platform of claim 1, wherein the persistence adapter stores session tokens and refresh tokens to an encrypted storage key and rotates or revokes tokens upon administrator action.

8. A method for enabling group grief sessions comprising: creating a named room, opening server-sent event streams to the room, posting messages to the room, and broadcasting messages to connected participants while applying per-recipient block filtering.

9. The method of claim 8, further comprising recording messages to the persistence adapter and replaying recent messages to newly connected participants upon joining.

10. A non-transitory computer-readable medium storing instructions which, when executed by one or more processors, cause the processors to perform operations implementing any of the systems or methods of claims 1-9.

Notes for counsel:
- These are draft, broad claims intended to capture both the architecture (adapter + SSE + privacy) and specific workflows (migration, share utility, moderation).
- For international filing, consider narrowing independent claims to specific technical steps that are clearly novel and non-obvious.
- Consider dependent claims addressing implementation details: PBKDF2 hashing for passwords, HMAC-signed tokens, grouping rules for rooms, and use of a single JSON blob key vs. normalized SQL tables.
