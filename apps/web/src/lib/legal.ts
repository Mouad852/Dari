export type LegalRelease = {
  entityName: string;
  address: string;
  registration: string;
  contact: string;
  jurisdiction: string;
  complaintAuthority: string;
  retention: string;
  processors: string;
  lawfulBases: string;
  effectiveDate: string;
  version: string;
  isFinal: boolean;
};

const value = (name: string, localLabel: string): string => process.env[name]?.trim() || localLabel;

export const legalRelease: LegalRelease = {
  entityName: value('DARI_LEGAL_ENTITY_NAME', '[Nom de l’exploitant à confirmer]'),
  address: value('DARI_LEGAL_ADDRESS', '[Adresse enregistrée à confirmer]'),
  registration: value('DARI_LEGAL_REGISTRATION', '[Registre, identifiant fiscal ou ICE à confirmer]'),
  contact: value('DARI_LEGAL_CONTACT', '[Contact confidentialité et support à confirmer]'),
  jurisdiction: value('DARI_LEGAL_JURISDICTION', '[Juridiction à confirmer avec le conseil juridique]'),
  complaintAuthority: value('DARI_LEGAL_COMPLAINT_AUTHORITY', '[Autorité de plainte à confirmer]'),
  retention: value('DARI_LEGAL_RETENTION', '[Durées de conservation à confirmer]'),
  processors: value('DARI_LEGAL_PROCESSORS', '[Sous-traitants à confirmer]'),
  lawfulBases: value('DARI_LEGAL_LAWFUL_BASES', '[Bases légales par finalité à confirmer]'),
  effectiveDate: value('DARI_LEGAL_EFFECTIVE_DATE', '[Date d’entrée en vigueur à confirmer]'),
  version: value('DARI_LEGAL_VERSION', '[Version à confirmer]'),
  isFinal: Boolean(process.env.DARI_LEGAL_ENTITY_NAME?.trim() && process.env.DARI_LEGAL_ADDRESS?.trim() && process.env.DARI_LEGAL_REGISTRATION?.trim() && process.env.DARI_LEGAL_CONTACT?.trim() && process.env.DARI_LEGAL_JURISDICTION?.trim() && process.env.DARI_LEGAL_COMPLAINT_AUTHORITY?.trim() && process.env.DARI_LEGAL_RETENTION?.trim() && process.env.DARI_LEGAL_PROCESSORS?.trim() && process.env.DARI_LEGAL_LAWFUL_BASES?.trim() && process.env.DARI_LEGAL_EFFECTIVE_DATE?.trim() && process.env.DARI_LEGAL_VERSION?.trim()),
};
