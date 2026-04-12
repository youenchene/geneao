// Package repository provides database access for GEDCOM entities.
package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/youenchene/geneao/backend/internal/model"
)

// IndividualRepo handles individual CRUD with history tracking.
type IndividualRepo struct {
	pool *pgxpool.Pool
}

// NewIndividualRepo creates a new individual repository.
func NewIndividualRepo(pool *pgxpool.Pool) *IndividualRepo {
	return &IndividualRepo{pool: pool}
}

// List returns all individuals.
func (r *IndividualRepo) List(ctx context.Context) ([]model.Individual, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, COALESCE(gedcom_id, ''), given_name, surname, sex,
		       birth_date, birth_place, death_date, death_place,
		       note, COALESCE(photo_key, ''), created_at, updated_at
		FROM individuals ORDER BY surname, given_name`)
	if err != nil {
		return nil, fmt.Errorf("list individuals: %w", err)
	}
	defer rows.Close()

	var result []model.Individual
	for rows.Next() {
		var i model.Individual
		if err := rows.Scan(&i.ID, &i.GedcomID, &i.GivenName, &i.Surname, &i.Sex,
			&i.BirthDate, &i.BirthPlace, &i.DeathDate, &i.DeathPlace,
			&i.Note, &i.PhotoKey, &i.CreatedAt, &i.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan individual: %w", err)
		}
		result = append(result, i)
	}
	return result, nil
}

// GetByID returns a single individual by UUID.
func (r *IndividualRepo) GetByID(ctx context.Context, id string) (*model.Individual, error) {
	var i model.Individual
	err := r.pool.QueryRow(ctx, `
		SELECT id, COALESCE(gedcom_id, ''), given_name, surname, sex,
		       birth_date, birth_place, death_date, death_place,
		       note, COALESCE(photo_key, ''), created_at, updated_at
		FROM individuals WHERE id = $1`, id).
		Scan(&i.ID, &i.GedcomID, &i.GivenName, &i.Surname, &i.Sex,
			&i.BirthDate, &i.BirthPlace, &i.DeathDate, &i.DeathPlace,
			&i.Note, &i.PhotoKey, &i.CreatedAt, &i.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("get individual %s: %w", id, err)
	}
	return &i, nil
}

// Create inserts a new individual and records history.
func (r *IndividualRepo) Create(ctx context.Context, req model.CreateIndividualRequest, changeSetID string) (*model.Individual, error) {
	var i model.Individual
	err := r.pool.QueryRow(ctx, `
		INSERT INTO individuals (given_name, surname, sex, birth_date, birth_place, death_date, death_place, note)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, COALESCE(gedcom_id, ''), given_name, surname, sex,
		          birth_date, birth_place, death_date, death_place,
		          note, COALESCE(photo_key, ''), created_at, updated_at`,
		req.GivenName, req.Surname, req.Sex, req.BirthDate, req.BirthPlace,
		req.DeathDate, req.DeathPlace, req.Note).
		Scan(&i.ID, &i.GedcomID, &i.GivenName, &i.Surname, &i.Sex,
			&i.BirthDate, &i.BirthPlace, &i.DeathDate, &i.DeathPlace,
			&i.Note, &i.PhotoKey, &i.CreatedAt, &i.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("create individual: %w", err)
	}

	// Record history
	_, err = r.pool.Exec(ctx, `
		INSERT INTO individual_history
			(change_set_id, individual_id, operation, given_name, surname, sex, birth_date, birth_place, death_date, death_place, note, photo_key)
		VALUES ($1, $2, 'INSERT', $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		changeSetID, i.ID, i.GivenName, i.Surname, i.Sex,
		i.BirthDate, i.BirthPlace, i.DeathDate, i.DeathPlace, i.Note, i.PhotoKey)
	if err != nil {
		return nil, fmt.Errorf("record individual history: %w", err)
	}

	return &i, nil
}

// Update modifies an existing individual and records history.
func (r *IndividualRepo) Update(ctx context.Context, id string, req model.CreateIndividualRequest, changeSetID string) (*model.Individual, error) {
	var i model.Individual
	err := r.pool.QueryRow(ctx, `
		UPDATE individuals
		SET given_name = $2, surname = $3, sex = $4,
		    birth_date = $5, birth_place = $6,
		    death_date = $7, death_place = $8, note = $9,
		    updated_at = now()
		WHERE id = $1
		RETURNING id, COALESCE(gedcom_id, ''), given_name, surname, sex,
		          birth_date, birth_place, death_date, death_place,
		          note, COALESCE(photo_key, ''), created_at, updated_at`,
		id, req.GivenName, req.Surname, req.Sex,
		req.BirthDate, req.BirthPlace, req.DeathDate, req.DeathPlace, req.Note).
		Scan(&i.ID, &i.GedcomID, &i.GivenName, &i.Surname, &i.Sex,
			&i.BirthDate, &i.BirthPlace, &i.DeathDate, &i.DeathPlace,
			&i.Note, &i.PhotoKey, &i.CreatedAt, &i.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("update individual %s: %w", id, err)
	}

	_, err = r.pool.Exec(ctx, `
		INSERT INTO individual_history
			(change_set_id, individual_id, operation, given_name, surname, sex, birth_date, birth_place, death_date, death_place, note, photo_key)
		VALUES ($1, $2, 'UPDATE', $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		changeSetID, i.ID, i.GivenName, i.Surname, i.Sex,
		i.BirthDate, i.BirthPlace, i.DeathDate, i.DeathPlace, i.Note, i.PhotoKey)
	if err != nil {
		return nil, fmt.Errorf("record individual history: %w", err)
	}

	return &i, nil
}

// UpdatePhoto sets the photo S3 key for an individual.
func (r *IndividualRepo) UpdatePhoto(ctx context.Context, id string, photoKey string) error {
	_, err := r.pool.Exec(ctx, `UPDATE individuals SET photo_key = $2, updated_at = now() WHERE id = $1`, id, photoKey)
	return err
}
