package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/youenchene/geneao/backend/internal/model"
)

// GedcomFileRepo tracks generated GEDCOM files in S3.
type GedcomFileRepo struct {
	pool *pgxpool.Pool
}

// NewGedcomFileRepo creates a new GEDCOM file repository.
func NewGedcomFileRepo(pool *pgxpool.Pool) *GedcomFileRepo {
	return &GedcomFileRepo{pool: pool}
}

// Create records a new GEDCOM file.
func (r *GedcomFileRepo) Create(ctx context.Context, s3Key string) (*model.GedcomFile, error) {
	var gf model.GedcomFile
	err := r.pool.QueryRow(ctx, `
		INSERT INTO gedcom_files (s3_key, version)
		VALUES ($1, COALESCE((SELECT MAX(version) FROM gedcom_files), 0) + 1)
		RETURNING id, s3_key, version, created_at`, s3Key).
		Scan(&gf.ID, &gf.S3Key, &gf.Version, &gf.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("create gedcom file: %w", err)
	}
	return &gf, nil
}

// GetLatest returns the most recent GEDCOM file record.
func (r *GedcomFileRepo) GetLatest(ctx context.Context) (*model.GedcomFile, error) {
	var gf model.GedcomFile
	err := r.pool.QueryRow(ctx, `
		SELECT id, s3_key, version, created_at
		FROM gedcom_files ORDER BY version DESC LIMIT 1`).
		Scan(&gf.ID, &gf.S3Key, &gf.Version, &gf.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("get latest gedcom file: %w", err)
	}
	return &gf, nil
}
