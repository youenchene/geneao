// Package main is the entry point for the Geneao backend server.
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

	"github.com/youenchene/geneao/backend/internal/auth"
	"github.com/youenchene/geneao/backend/internal/handler"
	"github.com/youenchene/geneao/backend/internal/migrate"
	"github.com/youenchene/geneao/backend/internal/repository"
	"github.com/youenchene/geneao/backend/internal/storage"
)

func main() {
	// ---- Configuration from environment ----
	port := envOrDefault("PORT", "8080")
	dbURL := envOrDefault("DATABASE_URL", "postgres://geneao:geneao@localhost:5432/geneao?sslmode=disable")
	sharedPassword := envOrDefault("GENEAO_PASSWORD", "changeme")
	jwtSecret := envOrDefault("JWT_SECRET", "super-secret-change-me")

	appTitle := os.Getenv("GENEAO_TITLE") // optional override for the frontend app title

	s3Endpoint := envOrDefault("S3_ENDPOINT", "http://localhost:9000")
	s3Bucket := envOrDefault("S3_BUCKET", "geneao")
	s3Region := envOrDefault("S3_REGION", "us-east-1")
	s3AccessKey := envOrDefault("S3_ACCESS_KEY", "minioadmin")
	s3SecretKey := envOrDefault("S3_SECRET_KEY", "minioadmin")
	allowedOrigins := envOrDefault("ALLOWED_ORIGINS", "http://localhost:5173")

	// ---- Database ----
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("Unable to ping database: %v", err)
	}
	log.Println("Connected to database")

	// ---- Run migrations ----
	if err := migrate.Run(ctx, pool, "db/migrations"); err != nil {
		log.Fatalf("Migration failed: %v", err)
	}
	log.Println("Migrations up to date")

	// ---- S3 Storage ----
	store, err := storage.New(storage.Config{
		Endpoint:  s3Endpoint,
		Bucket:    s3Bucket,
		Region:    s3Region,
		AccessKey: s3AccessKey,
		SecretKey: s3SecretKey,
	})
	if err != nil {
		log.Fatalf("Unable to initialize S3 storage: %v", err)
	}
	log.Println("S3 storage initialized")

	if err := store.EnsureBucket(ctx); err != nil {
		log.Fatalf("Unable to ensure S3 bucket: %v", err)
	}
	log.Println("S3 bucket ready")

	// ---- Repositories ----
	individualRepo := repository.NewIndividualRepo(pool)
	familyRepo := repository.NewFamilyRepo(pool)
	changeSetRepo := repository.NewChangeSetRepo(pool)
	gedcomFileRepo := repository.NewGedcomFileRepo(pool)

	// ---- Auth ----
	authService := auth.NewService(sharedPassword, jwtSecret)

	// ---- Echo server ----
	e := echo.New()
	e.HideBanner = true

	// Middleware
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins:     strings.Split(allowedOrigins, ","),
		AllowMethods:     []string{echo.GET, echo.POST, echo.PUT, echo.DELETE, echo.OPTIONS},
		AllowHeaders:     []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization},
		AllowCredentials: true, // required for HttpOnly cookie auth
	}))

	// ---- Routes ----
	h := handler.New(handler.Deps{
		IndividualRepo: individualRepo,
		FamilyRepo:     familyRepo,
		ChangeSetRepo:  changeSetRepo,
		GedcomFileRepo: gedcomFileRepo,
		Storage:        store,
		Auth:           authService,
		AppTitle:       appTitle,
	})

	// Public
	e.POST("/api/login", h.Login)
	e.GET("/api/config", h.GetConfig)

	// Protected
	api := e.Group("/api", auth.Middleware(jwtSecret))
	api.GET("/individuals", h.ListIndividuals)
	api.GET("/individuals/:id", h.GetIndividual)
	api.POST("/individuals", h.CreateIndividual)
	api.PUT("/individuals/:id", h.UpdateIndividual)
	api.POST("/individuals/:id/photo", h.UploadPhoto)
	api.GET("/individuals/:id/photo", h.GetPhoto)

	api.GET("/families", h.ListFamilies)
	api.GET("/families/:id", h.GetFamily)
	api.POST("/families", h.CreateFamily)
	api.PUT("/families/:id", h.UpdateFamily)

	api.GET("/gedcom/export", h.ExportGedcom)
	api.GET("/gedcom/file", h.GetGedcomFile)
	api.GET("/gedcom/download-latest", h.DownloadLatestGedcom)
	api.POST("/gedcom/import", h.ImportGedcom)

	api.GET("/tree", h.GetTree)

	// ---- Start ----
	go func() {
		addr := fmt.Sprintf(":%s", port)
		log.Printf("Starting server on %s", addr)
		if err := e.Start(addr); err != nil {
			log.Printf("Server stopped: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt)
	<-quit
	log.Println("Shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := e.Shutdown(ctx); err != nil {
		log.Fatal(err)
	}
}

func envOrDefault(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}
