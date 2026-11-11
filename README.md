# TravelAgency

## Database migrations

Run backend commands from `backend/`:

```bash
alembic upgrade head
```

For an existing database whose schema already matches the application models,
mark it as the initial revision:

```bash
alembic stamp 0001_initial_schema
```

Set `DATABASE_URL` before either command to migrate a database other than
`backend/travel_agency.db`. New databases are initialized by `alembic upgrade head`;
the API does not create or alter tables at startup.

## Destinations API

The destinations directory stores unique country-city pairs:

- `GET /api/destinations/` — list destinations.
- `GET /api/destinations/countries` — list countries and their slugs.
- `GET /api/destinations/{country_slug}/cities` — list cities in a country by slug.
- `POST /api/destinations/` — create a destination with `country`, `city`,
  `country_slug` and `city_slug`.

There are no update or delete operations for destinations.
