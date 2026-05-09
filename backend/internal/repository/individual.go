// Package repository provides database access for GEDCOM entities.
package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
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

// selectColumns lists every column returned by SELECT/RETURNING queries.
// Kept as a constant to stay in sync across List/GetByID/Create/Update/Delete.
const selectColumns = `id, COALESCE(gedcom_id, ''), given_name, surname,
		       name_prefix, name_suffix, nickname, sex,
		       birth_date, birth_place, death_date, death_place,
		       burial_date, burial_place, living_city, living_country,
		       occupation, email, phone,
		       note, COALESCE(photo_key, ''), created_at, updated_at`

// historyInsertSQL is the shared INSERT for individual_history snapshots.
const historyInsertSQL = `
	INSERT INTO individual_history
		(change_set_id, individual_id, operation,
		 given_name, surname, name_prefix, name_suffix, nickname, sex,
		 birth_date, birth_place, death_date, death_place,
		 burial_date, burial_place, living_city, living_country,
		 occupation, email, phone,
		 note, photo_key)
	VALUES ($1, $2, $3,
	        $4, $5, $6, $7, $8, $9,
	        $10, $11, $12, $13,
	        $14, $15, $16, $17,
	        $18, $19, $20,
	        $21, $22)`

// scanIndividual scans a pgx.Row into an Individual. Column order must match selectColumns.
func scanIndividual(row pgx.Row, i *model.Individual) error {
	return row.Scan(&i.ID, &i.GedcomID, &i.GivenName, &i.Surname,
		&i.NamePrefix, &i.NameSuffix, &i.Nickname, &i.Sex,
		&i.BirthDate, &i.BirthPlace, &i.DeathDate, &i.DeathPlace,
		&i.BurialDate, &i.BurialPlace, &i.LivingCity, &i.LivingCountry,
		&i.Occupation, &i.Email, &i.Phone,
		&i.Note, &i.PhotoKey, &i.CreatedAt, &i.UpdatedAt)
}

// historyArgs returns the positional args for historyInsertSQL.
func historyArgs(changeSetID string, i *model.Individual, operation string) []any {
	return []any{
		changeSetID, i.ID, operation,
		i.GivenName, i.Surname, i.NamePrefix, i.NameSuffix, i.Nickname, i.Sex,
		i.BirthDate, i.BirthPlace, i.DeathDate, i.DeathPlace,
		i.BurialDate, i.BurialPlace, i.LivingCity, i.LivingCountry,
		i.Occupation, i.Email, i.Phone,
		i.Note, i.PhotoKey,
	}
}

// List returns all individuals.
func (r *IndividualRepo) List(ctx context.Context) ([]model.Individual, error) {
	rows, err := r.pool.Query(ctx, `SELECT `+selectColumns+`
		FROM individuals ORDER BY surname, given_name`)
	if err != nil {
		return nil, fmt.Errorf("list individuals: %w", err)
	}
	defer rows.Close()

	var result []model.Individual
	for rows.Next() {
		var i model.Individual
		if err := scanIndividual(rows, &i); err != nil {
			return nil, fmt.Errorf("scan individual: %w", err)
		}
		result = append(result, i)
	}
	return result, nil
}

// GetByID returns a single individual by UUID.
func (r *IndividualRepo) GetByID(ctx context.Context, id string) (*model.Individual, error) {
	var i model.Individual
	err := scanIndividual(
		r.pool.QueryRow(ctx, `SELECT `+selectColumns+` FROM individuals WHERE id = $1`, id),
		&i,
	)
	if err != nil {
		return nil, fmt.Errorf("get individual %s: %w", id, err)
	}
	return &i, nil
}

// Create inserts a new individual and records history.
func (r *IndividualRepo) Create(ctx context.Context, req model.CreateIndividualRequest, changeSetID string) (*model.Individual, error) {
	var i model.Individual
	err := scanIndividual(
		r.pool.QueryRow(ctx, `
		INSERT INTO individuals (
			given_name, surname, name_prefix, name_suffix, nickname, sex,
			birth_date, birth_place, death_date, death_place,
			burial_date, burial_place, living_city, living_country,
			occupation, email, phone, note)
		VALUES ($1, $2, $3, $4, $5, $6,
		        $7, $8, $9, $10,
		        $11, $12, $13, $14,
		        $15, $16, $17, $18)
		RETURNING `+selectColumns,
			req.GivenName, req.Surname, req.NamePrefix, req.NameSuffix, req.Nickname, req.Sex,
			req.BirthDate, req.BirthPlace, req.DeathDate, req.DeathPlace,
			req.BurialDate, req.BurialPlace, req.LivingCity, req.LivingCountry,
			req.Occupation, req.Email, req.Phone, req.Note),
		&i,
	)
	if err != nil {
		return nil, fmt.Errorf("create individual: %w", err)
	}

	if _, err := r.pool.Exec(ctx, historyInsertSQL, historyArgs(changeSetID, &i, "INSERT")...); err != nil {
		return nil, fmt.Errorf("record individual history: %w", err)
	}

	return &i, nil
}

// Update modifies an existing individual and records history.
func (r *IndividualRepo) Update(ctx context.Context, id string, req model.CreateIndividualRequest, changeSetID string) (*model.Individual, error) {
	var i model.Individual
	err := scanIndividual(
		r.pool.QueryRow(ctx, `
		UPDATE individuals
		SET given_name = $2, surname = $3,
		    name_prefix = $4, name_suffix = $5, nickname = $6,
		    sex = $7,
		    birth_date = $8, birth_place = $9,
		    death_date = $10, death_place = $11,
		    burial_date = $12, burial_place = $13,
		    living_city = $14, living_country = $15,
		    occupation = $16, email = $17, phone = $18,
		    note = $19,
		    updated_at = now()
		WHERE id = $1
		RETURNING `+selectColumns,
			id,
			req.GivenName, req.Surname,
			req.NamePrefix, req.NameSuffix, req.Nickname,
			req.Sex,
			req.BirthDate, req.BirthPlace,
			req.DeathDate, req.DeathPlace,
			req.BurialDate, req.BurialPlace,
			req.LivingCity, req.LivingCountry,
			req.Occupation, req.Email, req.Phone,
			req.Note),
		&i,
	)
	if err != nil {
		return nil, fmt.Errorf("update individual %s: %w", id, err)
	}

	if _, err := r.pool.Exec(ctx, historyInsertSQL, historyArgs(changeSetID, &i, "UPDATE")...); err != nil {
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

// HasParents returns true if the individual is a child in any family.
func (r *IndividualRepo) HasParents(ctx context.Context, id string) (bool, error) {
	var count int
	err := r.pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM family_children
		WHERE child_id = $1`, id).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("check parents for %s: %w", id, err)
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
	if err := scanIndividual(
		tx.QueryRow(ctx, `SELECT `+selectColumns+` FROM individuals WHERE id = $1`, id),
		&i,
	); err != nil {
		return fmt.Errorf("read individual %s for delete: %w", id, err)
	}

	// Record DELETE history
	if _, err := tx.Exec(ctx, historyInsertSQL, historyArgs(changeSetID, &i, "DELETE")...); err != nil {
		return fmt.Errorf("record delete history: %w", err)
	}

	// Nullify husband_id where this person is husband
	if _, err := tx.Exec(ctx, `UPDATE families SET husband_id = NULL, updated_at = now() WHERE husband_id = $1`, id); err != nil {
		return fmt.Errorf("nullify husband: %w", err)
	}

	// Nullify wife_id where this person is wife
	if _, err := tx.Exec(ctx, `UPDATE families SET wife_id = NULL, updated_at = now() WHERE wife_id = $1`, id); err != nil {
		return fmt.Errorf("nullify wife: %w", err)
	}

	// Remove from family_children where this person is a child
	if _, err := tx.Exec(ctx, `DELETE FROM family_children WHERE child_id = $1`, id); err != nil {
		return fmt.Errorf("remove from family_children: %w", err)
	}

	// Delete childless families that lost a spouse due to this deletion
	// (families with no children and at most one spouse remaining are meaningless)
	if _, err := tx.Exec(ctx, `
		DELETE FROM families
		WHERE id NOT IN (SELECT DISTINCT family_id FROM family_children)
		AND (husband_id IS NULL OR wife_id IS NULL)`); err != nil {
		return fmt.Errorf("delete orphaned families: %w", err)
	}

	// Delete the individual
	if _, err := tx.Exec(ctx, `DELETE FROM individuals WHERE id = $1`, id); err != nil {
		return fmt.Errorf("delete individual %s: %w", id, err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}
