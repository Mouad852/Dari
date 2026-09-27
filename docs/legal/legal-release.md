# Legal release inputs

The legal pages read their release values from `apps/web/src/lib/legal.ts`.
Production builds fail unless every `DARI_LEGAL_*` value is supplied. Local
development shows explicit `à confirmer` markers and is not a legal release.

The owner and counsel must provide the operator/entity name, registered address,
registration/tax/ICE details, privacy/DPO/support contact, jurisdiction,
complaint authority, retention periods, processors, lawful basis per purpose,
effective date, and document version. Legal review is a release prerequisite.
