# Manual accessibility checklist

Run this checklist on a keyboard and with a screen reader before a release. Automated Axe checks cover repeatable DOM rules; this checklist covers interaction, wording, and map semantics that require human judgment.

- Use Tab, Shift+Tab, Enter, Space, and Escape without a mouse. Confirm the skip link, route heading focus, filter controls, cards, dialogs, and submit buttons have a visible focus indicator and a logical order.
- With a screen reader, confirm every page announces one useful level-one heading, loading/error/success states use an appropriate live region, and validation text is associated with its field.
- Search and filters: identify every control by its French label, understand the selected state of tabs/tags, reach “Appliquer les filtres” and “Afficher plus d’annonces”, and hear when the result set changes.
- Map controls: reach the map and its zoom controls from the keyboard, understand that map coordinates are approximate to the public, and use the manual coordinate fields to place or adjust a listing without pointer input.
- Dialogs: opening moves focus inside, Escape closes, focus returns to the trigger, and the title/instructions are announced before the action buttons.
- Forms: submit with missing values, confirm the first invalid field and its error are announced, and verify that focus does not disappear when a button becomes busy or a step changes.
- Image upload: reach the file control, understand accepted formats and size limits, hear upload failures, and confirm every preview has useful alternative text without exposing GPS metadata.
- Listing publication: navigate all wizard steps, hear progress, understand required fields and the moderation handoff, and confirm the final success state is announced.
- At 200% and 400% effective zoom, confirm no content or control is hidden behind overflow and the map/filter layout remains operable.
