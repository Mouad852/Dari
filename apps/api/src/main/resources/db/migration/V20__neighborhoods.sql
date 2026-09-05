-- Neighborhood reference data (TODO.md Priority 1: "seed production ... neighborhood
-- reference data"). Read-only lookup, not yet enforced -- listings.neighborhood stays
-- free text. City-membership validation (rejecting a listing whose neighborhood isn't
-- in this table) is a separate, larger decision tracked in plans/05-listing-creation.md
-- and plans/07-search-filters-and-map.md, since a launch-week gap in this list would
-- otherwise lock a real owner out of publishing.
CREATE TABLE neighborhoods (
    city        TEXT    NOT NULL,
    name        TEXT    NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (city, name)
);

INSERT INTO neighborhoods (city, name, sort_order) VALUES
    ('Rabat', 'Agdal', 1),
    ('Rabat', 'Hassan', 2),
    ('Rabat', 'Hay Riad', 3),
    ('Rabat', 'Souissi', 4),
    ('Rabat', 'Yacoub El Mansour', 5),
    ('Rabat', 'Océan', 6),
    ('Rabat', 'Médina', 7),
    ('Rabat', 'Aviation', 8),
    ('Rabat', 'Akkari', 9),
    ('Rabat', 'Al Irfane', 10),

    ('Casablanca', 'Maarif', 1),
    ('Casablanca', 'Racine', 2),
    ('Casablanca', 'Gauthier', 3),
    ('Casablanca', 'Bourgogne', 4),
    ('Casablanca', 'Anfa', 5),
    ('Casablanca', 'Ain Diab', 6),
    ('Casablanca', 'Sidi Belyout', 7),
    ('Casablanca', 'Californie', 8),
    ('Casablanca', 'Oasis', 9),
    ('Casablanca', 'Hay Hassani', 10),
    ('Casablanca', 'Sidi Maarouf', 11),
    ('Casablanca', 'Ain Sebaa', 12),

    ('Marrakech', 'Guéliz', 1),
    ('Marrakech', 'Hivernage', 2),
    ('Marrakech', 'Médina', 3),
    ('Marrakech', 'Semlalia', 4),
    ('Marrakech', 'Targa', 5),
    ('Marrakech', 'Daoudiate', 6),
    ('Marrakech', 'Massira', 7),
    ('Marrakech', 'M''Hamid', 8),
    ('Marrakech', 'Palmeraie', 9),

    ('Tanger', 'Centre-ville', 1),
    ('Tanger', 'Malabata', 2),
    ('Tanger', 'Iberia', 3),
    ('Tanger', 'Marshan', 4),
    ('Tanger', 'California', 5),
    ('Tanger', 'Boukhalef', 6),
    ('Tanger', 'Val Fleuri', 7),
    ('Tanger', 'Mesnana', 8)
ON CONFLICT DO NOTHING;
