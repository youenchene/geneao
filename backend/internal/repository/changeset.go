package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/youenchene/geneao/backend/internal/model"
)

// ChangeSetRepo manages change sets for history tracking.
type ChangeSetRepo struct {
	pool *pgxpool.Pool
}

// NewChangeSetRepo creates a new change set repository.
func NewChangeSetRepo(pool *pgxpool.Pool) *ChangeSetRepo {
	return &ChangeSetRepo{pool: pool}
}

// Create inserts a new change set and returns it.
func (r *ChangeSetRepo) Create(ctx context.Context, description string) (*model.ChangeSet, error) {
	var cs model.ChangeSet
	err := r.pool.QueryRow(ctx,
		`INSERT INTO change_sets (description) VALUES ($1) RETURNING id, description, created_at`,
		description).
		Scan(&cs.ID, &cs.Description, &cs.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("create change set: %w", err)
	}
	return &cs, nil
}

// List returns recent change sets ordered by creation date.
func (r *ChangeSetRepo) List(ctx context.Context, limit int) ([]model.ChangeSet, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := r.pool.Query(ctx,
		`SELECT id, description, created_at FROM change_sets ORDER BY created_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, fmt.Errorf("list change sets: %w", err)
	}
	defer rows.Close()

	var result []model.ChangeSet
	for rows.Next() {
		var cs model.ChangeSet
		if err := rows.Scan(&cs.ID, &cs.Description, &cs.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan change set: %w", err)
		}
		result = append(result, cs)
	}
	return result, nil
}
