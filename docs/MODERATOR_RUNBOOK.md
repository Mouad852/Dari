# Moderator runbook

This runbook is for the Dari moderation queue. Moderators should record the
reason for every action and should not disclose reporter identity or internal
investigation details to the reported person.

## Triage order

1. Handle reports involving threats, fraud, discrimination, or requests for
   payment outside the agreed rental process first.
2. Check the listing, account history, prior dismissed reports, and supporting
   context before acting.
3. Treat several reports from the same coordinated source as one investigation,
   not as automatic proof.
4. Use the narrowest action that protects people: dismiss, warn, suspend, or
   ban.

## Queue actions

| Action | Use when | Result |
| --- | --- | --- |
| Dismiss | The report is unsupported, duplicated, or within the stated rules | Close the pending reports and record the rationale |
| Warn | The issue is a first-time or low-risk breach that can be corrected | Notify the target in French with the specific correction |
| Suspend | There is a credible safety, fraud, or repeated conduct risk | Remove the listing or account from active use while investigating |
| Ban | The evidence shows serious or repeated abuse, evasion, or a direct safety threat | Permanently block the account and remove its active listings |

Do not ban solely because a report is popular. Escalate an immediate physical
safety concern to the incident owner and preserve the relevant evidence.

## Common reasons

- **Fraud or misleading listing:** compare the description, price, photos, and
  owner responses. Suspend when the mismatch is material or payment is
  requested before a legitimate visit or agreement.
- **Unauthorized broker:** look for repeated listings, contact details for
  multiple properties, or claims of representing an owner without evidence.
  Ask for proof before banning when the risk is not immediate.
- **Harassment or unsafe contact:** preserve the message context, protect the
  reporter, and suspend promptly when threats or coercion are credible.
- **Discrimination:** remove content that excludes people on a protected
  characteristic. A preference about room logistics is not a licence for
  discriminatory wording.
- **Location or privacy leak:** unpublish the listing, restrict access to the
  exact location, and escalate to the privacy owner. Do not paste exact
  coordinates into a report comment.

## After an action

Use the admin action endpoint with a factual, concise reason. The notification
to the target must explain the action and the correction without revealing the
reporter or promising a particular outcome. Reporter acknowledgments remain
generic. Recheck the queue after acting and confirm that the related reports
closed as expected.

For a suspected coordinated reporting attack, preserve timestamps and target
ids, avoid mass bans, rate-limit the abusive source if available, and escalate
before taking irreversible action.
