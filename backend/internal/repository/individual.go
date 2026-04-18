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
		       living_place, note, COALESCE(photo_key, ''), created_at, updated_at
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
			&i.LivingPlace, &i.Note, &i.PhotoKey, &i.CreatedAt, &i.UpdatedAt); err != nil {
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
		       living_place, note, COALESCE(photo_key, ''), created_at, updated_at
		FROM individuals WHERE id = $1`, id).
		Scan(&i.ID, &i.GedcomID, &i.GivenName, &i.Surname, &i.Sex,
			&i.BirthDate, &i.BirthPlace, &i.DeathDate, &i.DeathPlace,
			&i.LivingPlace, &i.Note, &i.PhotoKey, &i.CreatedAt, &i.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("get individual %s: %w", id, err)
	}
	return &i, nil
}

// Create inserts a new individual and records history.
func (r *IndividualRepo) Create(ctx context.Context, req model.CreateIndividualRequest, changeSetID string) (*model.Individual, error) {
	var i model.Individual
	err := r.pool.QueryRow(ctx, `
		INSERT INTO individuals (given_name, surname, sex, birth_date, birth_place, death_date, death_place, living_place, note)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, COALESCE(gedcom_id, ''), given_name, surname, sex,
		          birth_date, birth_place, death_date, death_place,
		          living_place, note, COALESCE(photo_key, ''), created_at, updated_at`,
		req.GivenName, req.Surname, req.Sex, req.BirthDate, req.BirthPlace,
		req.DeathDate, req.DeathPlace, req.LivingPlace, req.Note).
		Scan(&i.ID, &i.GedcomID, &i.GivenName, &i.Surname, &i.Sex,
			&i.BirthDate, &i.BirthPlace, &i.DeathDate, &i.DeathPlace,
			&i.LivingPlace, &i.Note, &i.PhotoKey, &i.CreatedAt, &i.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("create individual: %w", err)
	}

	// Record history
	_, err = r.pool.Exec(ctx, `
		INSERT INTO individual_history
			(change_set_id, individual_id, operation, given_name, surname, sex, birth_date, birth_place, death_date, death_place, living_place, note, photo_key)
		VALUES ($1, $2, 'INSERT', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
		changeSetID, i.ID, i.GivenName, i.Surname, i.Sex,
		i.BirthDate, i.BirthPlace, i.DeathDate, i.DeathPlace, i.LivingPlace, i.Note, i.PhotoKey)
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
		    death_date = $7, death_place = $8,
		    living_place = $9, note = $10,
		    updated_at = now()
		WHERE id = $1
		RETURNING id, COALESCE(gedcom_id, ''), given_name, surname, sex,
		          birth_date, birth_place, death_date, death_place,
		          living_place, note, COALESCE(photo_key, ''), created_at, updated_at`,
		id, req.GivenName, req.Surname, req.Sex,
		req.BirthDate, req.BirthPlace, req.DeathDate, req.DeathPlace,
		req.LivingPlace, req.Note).
		Scan(&i.ID, &i.GedcomID, &i.GivenName, &i.Surname, &i.Sex,
			&i.BirthDate, &i.BirthPlace, &i.DeathDate, &i.DeathPlace,
			&i.LivingPlace, &i.Note, &i.PhotoKey, &i.CreatedAt, &i.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("update individual %s: %w", id, err)
	}

	_, err = r.pool.Exec(ctx, `
		INSERT INTO individual_history
			(change_set_id, individual_id, operation, given_name, surname, sex, birth_date, birth_place, death_date, death_place, living_place, note, photo_key)
		VALUES ($1, $2, 'UPDATE', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
		changeSetID, i.ID, i.GivenName, i.Surname, i.Sex,
		i.BirthDate, i.BirthPlace, i.DeathDate, i.DeathPlace, i.LivingPlace, i.Note, i.PhotoKey)
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

// HasChildren returns true if the individual is a husband or wife in any family
// that has at least one child in family_children.
func (r *IndividualRepo) HasChildren(ctx context.Context, id string) (bool, error) {
	var count int
	err := r.pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM families f
		JOIN family_children fc ON fc.family_id = f.id
		WHERE f.husband_id = $1 OR f.wife_id = $1`, id).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("check children for %s: %w", id, err)
	}
	return count > 0, nil
}

// Delete removes an individual and cleans up family references.
// It nullifies husband_id/wife_id in families where the person is a spouse,
// removes the person from family_children where they appear as a child,
// deletes any families left with both husband and wife NULL,
// and records a DELETE entry in individual_history.
func (r *IndividualRepo) Delete(ctx context.Context, id string, changeSetID string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Read current state for history
	var i model.Individual
	err = tx.QueryRow(ctx, `
		SELECT id, COALESCE(gedcom_id, ''), given_name, surname, sex,
		       birth_date, birth_place, death_date, death_place,
		       living_place, note, COALESCE(photo_key, ''), created_at, updated_at
		FROM individuals WHERE id = $1`, id).
		Scan(&i.ID, &i.GedcomID, &i.GivenName, &i.Surname, &i.Sex,
			&i.BirthDate, &i.BirthPlace, &i.DeathDate, &i.DeathPlace,
			&i.LivingPlace, &i.Note, &i.PhotoKey, &i.CreatedAt, &i.UpdatedAt)
	if err != nil {
		return fmt.Errorf("read individual %s for delete: %w", id, err)
	}

	// Record DELETE history
	_, err = tx.Exec(ctx, `
		INSERT INTO individual_history
			(change_set_id, individual_id, operation, given_name, surname, sex, birth_date, birth_place, death_date, death_place, living_place, note, photo_key)
		VALUES ($1, $2, 'DELETE', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
		changeSetID, i.ID, i.GivenName, i.Surname, i.Sex,
		i.BirthDate, i.BirthPlace, i.DeathDate, i.DeathPlace, i.LivingPlace, i.Note, i.PhotoKey)
	if err != nil {
		return fmt.Errorf("record delete history: %w", err)
	}

	// Nullify husband_id where this person is husband
	_, err = tx.Exec(ctx, `UPDATE families SET husband_id = NULL, updated_at = now() WHERE husband_id = $1`, id)
	if err != nil {
		return fmt.Errorf("nullify husband: %w", err)
	}

	// Nullify wife_id where this person is wife
	_, err = tx.Exec(ctx, `UPDATE families SET wife_id = NULL, updated_at = now() WHERE wife_id = $1`, id)
	if err != nil {
		return fmt.Errorf("nullify wife: %w", err)
	}

	// Remove from family_children where this person is a child
	_, err = tx.Exec(ctx, `DELETE FROM family_children WHERE child_id = $1`, id)
	if err != nil {
		return fmt.Errorf("remove from family_children: %w", err)
	}

	// Delete childless families that lost a spouse due to this deletion
	// (families with no children and at most one spouse remaining are meaningless)
	_, err = tx.Exec(ctx, `
		DELETE FROM families
		WHERE id NOT IN (SELECT DISTINCT family_id FROM family_children)
		AND (husband_id IS NULL OR wife_id IS NULL)`)
	if err != nil {
		return fmt.Errorf("delete orphaned families: %w", err)
	}

	// Delete the individual
	_, err = tx.Exec(ctx, `DELETE FROM individuals WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete individual %s: %w", id, err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}
