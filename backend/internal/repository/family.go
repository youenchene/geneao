package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/youenchene/geneao/backend/internal/model"
)

// FamilyRepo handles family CRUD with history tracking.
type FamilyRepo struct {
	pool *pgxpool.Pool
}

// NewFamilyRepo creates a new family repository.
func NewFamilyRepo(pool *pgxpool.Pool) *FamilyRepo {
	return &FamilyRepo{pool: pool}
}

// List returns all families with their child IDs.
func (r *FamilyRepo) List(ctx context.Context) ([]model.Family, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT f.id, COALESCE(f.gedcom_id, ''), f.husband_id, f.wife_id,
		       f.marriage_date, f.marriage_place, f.divorce_date, f.note,
		       f.created_at, f.updated_at,
		       COALESCE(array_agg(fc.child_id ORDER BY fc.sort_order) FILTER (WHERE fc.child_id IS NOT NULL), '{}')
		FROM families f
		LEFT JOIN family_children fc ON fc.family_id = f.id
		GROUP BY f.id
		ORDER BY f.created_at`)
	if err != nil {
		return nil, fmt.Errorf("list families: %w", err)
	}
	defer rows.Close()

	var result []model.Family
	for rows.Next() {
		var f model.Family
		if err := rows.Scan(&f.ID, &f.GedcomID, &f.HusbandID, &f.WifeID,
			&f.MarriageDate, &f.MarriagePlace, &f.DivorceDate, &f.Note,
			&f.CreatedAt, &f.UpdatedAt, &f.ChildIDs); err != nil {
			return nil, fmt.Errorf("scan family: %w", err)
		}
		result = append(result, f)
	}
	return result, nil
}

// GetByID returns a single family by UUID.
func (r *FamilyRepo) GetByID(ctx context.Context, id string) (*model.Family, error) {
	var f model.Family
	err := r.pool.QueryRow(ctx, `
		SELECT f.id, COALESCE(f.gedcom_id, ''), f.husband_id, f.wife_id,
		       f.marriage_date, f.marriage_place, f.divorce_date, f.note,
		       f.created_at, f.updated_at,
		       COALESCE(array_agg(fc.child_id ORDER BY fc.sort_order) FILTER (WHERE fc.child_id IS NOT NULL), '{}')
		FROM families f
		LEFT JOIN family_children fc ON fc.family_id = f.id
		WHERE f.id = $1
		GROUP BY f.id`, id).
		Scan(&f.ID, &f.GedcomID, &f.HusbandID, &f.WifeID,
			&f.MarriageDate, &f.MarriagePlace, &f.DivorceDate, &f.Note,
			&f.CreatedAt, &f.UpdatedAt, &f.ChildIDs)
	if err != nil {
		return nil, fmt.Errorf("get family %s: %w", id, err)
	}
	return &f, nil
}

// sanitizeUUID converts empty-string *string to nil so Postgres doesn't
// receive "" where it expects a UUID (or NULL).
func sanitizeUUID(p *string) *string {
	if p != nil && *p == "" {
		return nil
	}
	return p
}

// Create inserts a new family with children and records history.
func (r *FamilyRepo) Create(ctx context.Context, req model.CreateFamilyRequest, changeSetID string) (*model.Family, error) {
	req.HusbandID = sanitizeUUID(req.HusbandID)
	req.WifeID = sanitizeUUID(req.WifeID)

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var f model.Family
	err = tx.QueryRow(ctx, `
		INSERT INTO families (husband_id, wife_id, marriage_date, marriage_place, divorce_date, note)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, COALESCE(gedcom_id, ''), husband_id, wife_id,
		          marriage_date, marriage_place, divorce_date, note,
		          created_at, updated_at`,
		req.HusbandID, req.WifeID, req.MarriageDate, req.MarriagePlace,
		req.DivorceDate, req.Note).
		Scan(&f.ID, &f.GedcomID, &f.HusbandID, &f.WifeID,
			&f.MarriageDate, &f.MarriagePlace, &f.DivorceDate, &f.Note,
			&f.CreatedAt, &f.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("create family: %w", err)
	}

	// Insert children
	for i, childID := range req.ChildIDs {
		_, err = tx.Exec(ctx, `INSERT INTO family_children (family_id, child_id, sort_order) VALUES ($1, $2, $3)`,
			f.ID, childID, i)
		if err != nil {
			return nil, fmt.Errorf("add child %s to family: %w", childID, err)
		}
	}
	f.ChildIDs = req.ChildIDs

	// Record history
	_, err = tx.Exec(ctx, `
		INSERT INTO family_history
			(change_set_id, family_id, operation, husband_id, wife_id, marriage_date, marriage_place, divorce_date, note, child_ids)
		VALUES ($1, $2, 'INSERT', $3, $4, $5, $6, $7, $8, $9)`,
		changeSetID, f.ID, f.HusbandID, f.WifeID,
		f.MarriageDate, f.MarriagePlace, f.DivorceDate, f.Note, req.ChildIDs)
	if err != nil {
		return nil, fmt.Errorf("record family history: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	return &f, nil
}

// Update modifies an existing family and records history.
// Fields in req that are nil (*string) are preserved from the current row,
// so callers can send a partial update without wiping existing values.
func (r *FamilyRepo) Update(ctx context.Context, id string, req model.CreateFamilyRequest, changeSetID string) (*model.Family, error) {
	req.HusbandID = sanitizeUUID(req.HusbandID)
	req.WifeID = sanitizeUUID(req.WifeID)

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Read the current row so we can merge nil fields from the request
	// with the existing values (partial-update semantics).
	var current model.Family
	err = tx.QueryRow(ctx, `
		SELECT husband_id, wife_id, marriage_date, marriage_place, divorce_date, note
		FROM families WHERE id = $1`, id).
		Scan(&current.HusbandID, &current.WifeID,
			&current.MarriageDate, &current.MarriagePlace,
			&current.DivorceDate, &current.Note)
	if err != nil {
		return nil, fmt.Errorf("read current family %s: %w", id, err)
	}

	// Merge: use request value if provided, else keep current value.
	if req.HusbandID == nil {
		req.HusbandID = current.HusbandID
	}
	if req.WifeID == nil {
		req.WifeID = current.WifeID
	}
	if req.MarriageDate == "" {
		req.MarriageDate = current.MarriageDate
	}
	if req.MarriagePlace == "" {
		req.MarriagePlace = current.MarriagePlace
	}
	if req.DivorceDate == "" {
		req.DivorceDate = current.DivorceDate
	}
	if req.Note == "" {
		req.Note = current.Note
	}

	var f model.Family
	err = tx.QueryRow(ctx, `
		UPDATE families
		SET husband_id = $2, wife_id = $3, marriage_date = $4,
		    marriage_place = $5, divorce_date = $6, note = $7, updated_at = now()
		WHERE id = $1
		RETURNING id, COALESCE(gedcom_id, ''), husband_id, wife_id,
		          marriage_date, marriage_place, divorce_date, note,
		          created_at, updated_at`,
		id, req.HusbandID, req.WifeID, req.MarriageDate,
		req.MarriagePlace, req.DivorceDate, req.Note).
		Scan(&f.ID, &f.GedcomID, &f.HusbandID, &f.WifeID,
			&f.MarriageDate, &f.MarriagePlace, &f.DivorceDate, &f.Note,
			&f.CreatedAt, &f.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("update family %s: %w", id, err)
	}

	// Replace children
	_, err = tx.Exec(ctx, `DELETE FROM family_children WHERE family_id = $1`, id)
	if err != nil {
		return nil, fmt.Errorf("clear children: %w", err)
	}
	for i, childID := range req.ChildIDs {
		_, err = tx.Exec(ctx, `INSERT INTO family_children (family_id, child_id, sort_order) VALUES ($1, $2, $3)`,
			id, childID, i)
		if err != nil {
			return nil, fmt.Errorf("add child %s: %w", childID, err)
		}
	}
	f.ChildIDs = req.ChildIDs

	// Record history
	_, err = tx.Exec(ctx, `
		INSERT INTO family_history
			(change_set_id, family_id, operation, husband_id, wife_id, marriage_date, marriage_place, divorce_date, note, child_ids)
		VALUES ($1, $2, 'UPDATE', $3, $4, $5, $6, $7, $8, $9)`,
		changeSetID, f.ID, f.HusbandID, f.WifeID,
		f.MarriageDate, f.MarriagePlace, f.DivorceDate, f.Note, req.ChildIDs)
	if err != nil {
		return nil, fmt.Errorf("record family history: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	return &f, nil
}
