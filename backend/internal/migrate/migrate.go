// Package migrate runs SQL migration files on startup.
// It tracks applied migrations in a schema_migrations table and
// executes new ones in filename order.
package migrate

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Run applies all pending SQL migrations from dir to the database.
// Migrations are executed in lexicographic filename order.
// Already-applied migrations (tracked in schema_migrations) are skipped.
func Run(ctx context.Context, pool *pgxpool.Pool, dir string) error {
	// Ensure the tracking table exists.
	if _, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			filename TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)`); err != nil {
		return fmt.Errorf("create schema_migrations table: %w", err)
	}

	// Collect already-applied filenames.
	rows, err := pool.Query(ctx, `SELECT filename FROM schema_migrations`)
	if err != nil {
		return fmt.Errorf("query schema_migrations: %w", err)
	}
	defer rows.Close()

	applied := make(map[string]bool)
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return fmt.Errorf("scan migration row: %w", err)
		}
		applied[name] = true
	}
	rows.Close() // Close early so we can run other queries

	// Backwards compatibility: if the database was initialized before the migration system
	// was added, the 'individuals' table will exist but '001_initial_schema.sql' won't be in schema_migrations.
	if !applied["001_initial_schema.sql"] {
		var exists bool
		err := pool.QueryRow(ctx, `
			SELECT EXISTS (
				SELECT FROM information_schema.tables 
				WHERE table_schema = 'public' AND table_name = 'individuals'
			)`).Scan(&exists)
		if err != nil {
			return fmt.Errorf("check if individuals table exists: %w", err)
		}
		if exists {
			log.Printf("Legacy database detected: marking 001_initial_schema.sql as applied")
			if _, err := pool.Exec(ctx, `INSERT INTO schema_migrations (filename) VALUES ('001_initial_schema.sql')`); err != nil {
				return fmt.Errorf("record legacy migration: %w", err)
			}
			applied["001_initial_schema.sql"] = true

			// Also check if 002_add_living_place.sql was already applied
			var hasLivingPlace bool
			err = pool.QueryRow(ctx, `
				SELECT EXISTS (
					SELECT FROM information_schema.columns 
					WHERE table_schema = 'public' AND table_name = 'individuals' AND column_name = 'living_place'
				)`).Scan(&hasLivingPlace)
			if err == nil && hasLivingPlace {
				log.Printf("Legacy database detected: marking 002_add_living_place.sql as applied")
				if _, err := pool.Exec(ctx, `INSERT INTO schema_migrations (filename) VALUES ('002_add_living_place.sql') ON CONFLICT DO NOTHING`); err == nil {
					applied["002_add_living_place.sql"] = true
				}
			}
		}
	}

	// Read and sort migration files.
	entries, err := os.ReadDir(dir)
	if err != nil {
		return fmt.Errorf("read migrations dir %s: %w", dir, err)
	}

	var files []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)

	// Apply pending migrations.
	for _, name := range files {
		if applied[name] {
			continue
		}

		path := filepath.Join(dir, name)
		sql, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", name, err)
		}

		log.Printf("Applying migration: %s", name)
		if _, err := pool.Exec(ctx, string(sql)); err != nil {
			return fmt.Errorf("apply migration %s: %w", name, err)
		}

		if _, err := pool.Exec(ctx, `INSERT INTO schema_migrations (filename) VALUES ($1)`, name); err != nil {
			return fmt.Errorf("record migration %s: %w", name, err)
		}
		log.Printf("Migration applied: %s", name)
	}

	return nil
}
