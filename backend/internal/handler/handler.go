// Package handler contains HTTP handlers for the Geneao API.
package handler

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/youenchene/geneao/backend/internal/auth"
	"github.com/youenchene/geneao/backend/internal/gedcom"
	"github.com/youenchene/geneao/backend/internal/model"
	"github.com/youenchene/geneao/backend/internal/repository"
	"github.com/youenchene/geneao/backend/internal/storage"
)

// uuidRegex validates UUID format to prevent path traversal in S3 keys.
var uuidRegex = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// maxUploadSize limits file uploads to 10 MB.
const maxUploadSize = 10 << 20 // 10 MB

// allowedImageTypes are the only MIME types accepted for photo uploads.
var allowedImageTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

// Deps groups all handler dependencies.
type Deps struct {
	IndividualRepo *repository.IndividualRepo
	FamilyRepo     *repository.FamilyRepo
	ChangeSetRepo  *repository.ChangeSetRepo
	GedcomFileRepo *repository.GedcomFileRepo
	Storage        *storage.Store
	Auth           *auth.Service
	AppTitle       string // optional override for the frontend app title (GENEAO_TITLE)
}

// Handler contains all HTTP handlers.
type Handler struct {
	deps Deps
}

// photoProxyURL returns the backend proxy path for an individual's photo.
func photoProxyURL(individualID string) string {
	return "/api/individuals/" + individualID + "/photo"
}

// New creates a new handler.
func New(deps Deps) *Handler {
	return &Handler{deps: deps}
}

// Login authenticates with the shared password.
// Sets JWT as an HttpOnly cookie for security (not accessible to JS).
func (h *Handler) Login(c echo.Context) error {
	var req model.LoginRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}
	if !h.deps.Auth.ValidatePassword(req.Password) {
		log.Printf("WARNING: Failed login attempt from IP: %s", c.RealIP())
		time.Sleep(2 * time.Second)
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid password"})
	}
	token, err := h.deps.Auth.GenerateToken()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "token generation failed"})
	}

	// Set JWT as HttpOnly cookie (not accessible to client-side JS)
	c.SetCookie(&http.Cookie{
		Name:     "geneao_token",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   c.Scheme() == "https",
		SameSite: http.SameSiteStrictMode,
		MaxAge:   86400, // 24 hours
	})

	return c.JSON(http.StatusOK, model.LoginResponse{Token: token})
}

// GetConfig returns public frontend configuration.
// The title field is empty when GENEAO_TITLE is not set.
func (h *Handler) GetConfig(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]string{
		"title": h.deps.AppTitle,
	})
}

// ListIndividuals returns all individuals.
func (h *Handler) ListIndividuals(c echo.Context) error {
	individuals, err := h.deps.IndividualRepo.List(c.Request().Context())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	// Attach photo proxy URLs
	for i := range individuals {
		if individuals[i].PhotoKey != "" {
			individuals[i].PhotoURL = photoProxyURL(individuals[i].ID)
		}
	}
	return c.JSON(http.StatusOK, individuals)
}

// GetIndividual returns a single individual.
func (h *Handler) GetIndividual(c echo.Context) error {
	indi, err := h.deps.IndividualRepo.GetByID(c.Request().Context(), c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "individual not found"})
	}
	if indi.PhotoKey != "" {
		indi.PhotoURL = photoProxyURL(indi.ID)
	}
	return c.JSON(http.StatusOK, indi)
}

// CreateIndividual creates a new individual.
func (h *Handler) CreateIndividual(c echo.Context) error {
	var req model.CreateIndividualRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}
	cs, err := h.deps.ChangeSetRepo.Create(c.Request().Context(),
		fmt.Sprintf("Create individual: %s %s", req.GivenName, req.Surname))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	indi, err := h.deps.IndividualRepo.Create(c.Request().Context(), req, cs.ID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	go h.backupGedcomToS3()
	return c.JSON(http.StatusCreated, indi)
}

// UpdateIndividual modifies an existing individual.
func (h *Handler) UpdateIndividual(c echo.Context) error {
	var req model.CreateIndividualRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}
	cs, err := h.deps.ChangeSetRepo.Create(c.Request().Context(),
		fmt.Sprintf("Update individual: %s %s", req.GivenName, req.Surname))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	indi, err := h.deps.IndividualRepo.Update(c.Request().Context(), c.Param("id"), req, cs.ID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	go h.backupGedcomToS3()
	return c.JSON(http.StatusOK, indi)
}

// UploadPhoto handles photo upload for an individual.
func (h *Handler) UploadPhoto(c echo.Context) error {
	id := c.Param("id")

	// Validate UUID to prevent path traversal in S3 keys
	if !uuidRegex.MatchString(id) {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid id format"})
	}

	// Enforce upload size limit
	c.Request().Body = http.MaxBytesReader(c.Response(), c.Request().Body, maxUploadSize)

	file, err := c.FormFile("photo")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "photo file required (max 10MB)"})
	}
	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "cannot open file"})
	}
	defer src.Close()

	// Detect actual content type from file bytes (not client header)
	head := make([]byte, 512)
	n, err := src.Read(head)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "cannot read file"})
	}
	detectedType := http.DetectContentType(head[:n])

	// Validate against whitelist
	ext, ok := allowedImageTypes[detectedType]
	if !ok {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": fmt.Sprintf("unsupported image type: %s (allowed: jpeg, png, webp)", detectedType),
		})
	}

	// Seek back to start so the S3 upload contains the full file.
	// src (multipart.File) implements io.ReadSeeker, which the AWS SDK
	// needs to compute Content-Length for the PUT request.
	if _, err := src.Seek(0, io.SeekStart); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "cannot read file"})
	}

	key := fmt.Sprintf("photos/%s%s", id, ext)
	if err := h.deps.Storage.Upload(c.Request().Context(), key, src, detectedType); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "upload failed"})
	}
	if err := h.deps.IndividualRepo.UpdatePhoto(c.Request().Context(), id, key); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "db update failed"})
	}

	return c.JSON(http.StatusOK, map[string]string{"photo_url": photoProxyURL(id), "photo_key": key})
}

// GetPhoto streams an individual's photo from S3 to the client.
func (h *Handler) GetPhoto(c echo.Context) error {
	id := c.Param("id")
	if !uuidRegex.MatchString(id) {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid id format"})
	}

	indi, err := h.deps.IndividualRepo.GetByID(c.Request().Context(), id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "individual not found"})
	}
	if indi.PhotoKey == "" {
		return c.NoContent(http.StatusNotFound)
	}

	body, err := h.deps.Storage.Download(c.Request().Context(), indi.PhotoKey)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "photo not found in storage"})
	}
	defer body.Close()

	// Infer content type from the photo key extension
	contentType := "image/jpeg"
	switch {
	case strings.HasSuffix(indi.PhotoKey, ".png"):
		contentType = "image/png"
	case strings.HasSuffix(indi.PhotoKey, ".webp"):
		contentType = "image/webp"
	}

	c.Response().Header().Set("Cache-Control", "public, max-age=3600")
	return c.Stream(http.StatusOK, contentType, body)
}

// ListFamilies returns all families.
func (h *Handler) ListFamilies(c echo.Context) error {
	families, err := h.deps.FamilyRepo.List(c.Request().Context())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, families)
}

// GetFamily returns a single family.
func (h *Handler) GetFamily(c echo.Context) error {
	fam, err := h.deps.FamilyRepo.GetByID(c.Request().Context(), c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "family not found"})
	}
	return c.JSON(http.StatusOK, fam)
}

// CreateFamily creates a new family.
func (h *Handler) CreateFamily(c echo.Context) error {
	var req model.CreateFamilyRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}
	cs, err := h.deps.ChangeSetRepo.Create(c.Request().Context(), "Create family")
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	fam, err := h.deps.FamilyRepo.Create(c.Request().Context(), req, cs.ID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	go h.backupGedcomToS3()
	return c.JSON(http.StatusCreated, fam)
}

// UpdateFamily modifies an existing family.
func (h *Handler) UpdateFamily(c echo.Context) error {
	var req model.CreateFamilyRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}
	cs, err := h.deps.ChangeSetRepo.Create(c.Request().Context(), "Update family")
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	fam, err := h.deps.FamilyRepo.Update(c.Request().Context(), c.Param("id"), req, cs.ID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	go h.backupGedcomToS3()
	return c.JSON(http.StatusOK, fam)
}

// ExportGedcom generates and returns a GEDCOM file.
func (h *Handler) ExportGedcom(c echo.Context) error {
	ctx := c.Request().Context()
	individuals, err := h.deps.IndividualRepo.List(ctx)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	families, err := h.deps.FamilyRepo.List(ctx)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	gedcomText := gedcom.Generate(individuals, families)

	// Upload to S3
	reader := strings.NewReader(gedcomText)
	key := fmt.Sprintf("gedcom/export_%d.ged", time.Now().Unix())
	if err := h.deps.Storage.Upload(ctx, key, reader, "text/plain"); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "s3 upload failed"})
	}

	// Record in DB
	if _, err := h.deps.GedcomFileRepo.Create(ctx, key); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "db record failed"})
	}

	c.Response().Header().Set("Content-Type", "text/plain")
	c.Response().Header().Set("Content-Disposition", "attachment; filename=geneao.ged")
	return c.String(http.StatusOK, gedcomText)
}

// ImportGedcom parses an uploaded .ged file, stores it in S3, and populates the database.
func (h *Handler) ImportGedcom(c echo.Context) error {
	// Enforce upload size limit (10 MB)
	c.Request().Body = http.MaxBytesReader(c.Response(), c.Request().Body, maxUploadSize)

	file, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "ged file required (max 10MB)"})
	}
	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "cannot open file"})
	}
	defer src.Close()

	// Read into memory for both S3 upload and parsing
	data, err := io.ReadAll(io.LimitReader(src, maxUploadSize))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "cannot read file"})
	}

	ctx := c.Request().Context()

	// Upload to S3
	key := fmt.Sprintf("gedcom/import_%d.ged", time.Now().Unix())
	if err := h.deps.Storage.Upload(ctx, key, strings.NewReader(string(data)), "text/plain"); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "s3 upload failed"})
	}

	// Record file in DB
	if _, err := h.deps.GedcomFileRepo.Create(ctx, key); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "db record failed"})
	}

	// Parse GEDCOM and populate DB
	indiCount, famCount, err := gedcom.ImportIntoDB(
		ctx, string(data),
		h.deps.IndividualRepo, h.deps.FamilyRepo, h.deps.ChangeSetRepo,
	)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("import failed: %v", err)})
	}

	go h.backupGedcomToS3()

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message":     "file imported",
		"s3_key":      key,
		"individuals": indiCount,
		"families":    famCount,
	})
}

// GetGedcomFile generates a .ged file from the database and returns it.
func (h *Handler) GetGedcomFile(c echo.Context) error {
	ctx := c.Request().Context()

	individuals, err := h.deps.IndividualRepo.List(ctx)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	families, err := h.deps.FamilyRepo.List(ctx)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	gedcomText := gedcom.Generate(individuals, families)

	c.Response().Header().Set("Content-Type", "text/plain; charset=utf-8")
	c.Response().Header().Set("Content-Disposition", "inline; filename=\"geneao.ged\"")
	return c.String(http.StatusOK, gedcomText)
}

// DownloadLatestGedcom fetches the most recent GEDCOM backup from S3 and streams it to the client.
func (h *Handler) DownloadLatestGedcom(c echo.Context) error {
	ctx := c.Request().Context()

	latest, err := h.deps.GedcomFileRepo.GetLatest(ctx)
	if err != nil {
		if strings.Contains(err.Error(), "no rows") {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "no backup found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	body, err := h.deps.Storage.Download(ctx, latest.S3Key)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to download from storage"})
	}
	defer body.Close()

	c.Response().Header().Set("Content-Type", "text/plain; charset=utf-8")
	c.Response().Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"geneao_backup_v%d.ged\"", latest.Version))
	return c.Stream(http.StatusOK, "text/plain; charset=utf-8", body)
}

// backupGedcomToS3 generates a GEDCOM file from the current DB state and uploads it to S3.
// Called in a goroutine after every tree mutation (create, update, delete, import).
// Uses context.Background() because the HTTP request context is already done.
func (h *Handler) backupGedcomToS3() {
	ctx := context.Background()
	individuals, err := h.deps.IndividualRepo.List(ctx)
	if err != nil {
		log.Printf("backup: list individuals: %v", err)
		return
	}
	families, err := h.deps.FamilyRepo.List(ctx)
	if err != nil {
		log.Printf("backup: list families: %v", err)
		return
	}

	gedcomText := gedcom.Generate(individuals, families)
	key := fmt.Sprintf("gedcom/backup_%d.ged", time.Now().Unix())
	if err := h.deps.Storage.Upload(ctx, key, strings.NewReader(gedcomText), "text/plain"); err != nil {
		log.Printf("backup: s3 upload: %v", err)
		return
	}
	if _, err := h.deps.GedcomFileRepo.Create(ctx, key); err != nil {
		log.Printf("backup: record file: %v", err)
	}
}

// GetTree returns the full tree data (all individuals + families) for the frontend viewer.
func (h *Handler) GetTree(c echo.Context) error {
	ctx := c.Request().Context()
	individuals, err := h.deps.IndividualRepo.List(ctx)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	families, err := h.deps.FamilyRepo.List(ctx)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Attach photo proxy URLs
	for i := range individuals {
		if individuals[i].PhotoKey != "" {
			individuals[i].PhotoURL = photoProxyURL(individuals[i].ID)
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"individuals": individuals,
		"families":    families,
	})
}
