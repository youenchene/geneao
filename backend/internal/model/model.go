// Package model defines the domain types shared across all layers.
package model

import "time"

// Individual represents a person in the genealogy tree.
type Individual struct {
	ID            string    `json:"id"`
	GedcomID      string    `json:"gedcom_id"`
	GivenName     string    `json:"given_name"`
	Surname       string    `json:"surname"`
	NamePrefix    string    `json:"name_prefix"` // GEDCOM NAME/NPFX (e.g. "Dr.", "Rev.")
	NameSuffix    string    `json:"name_suffix"` // GEDCOM NAME/NSFX (e.g. "Jr.", "III")
	Nickname      string    `json:"nickname"`    // GEDCOM NAME/NICK
	Sex           string    `json:"sex"`         // M, F, U
	BirthDate     string    `json:"birth_date"`
	BirthPlace    string    `json:"birth_place"`
	DeathDate     string    `json:"death_date"`
	DeathPlace    string    `json:"death_place"`
	BurialDate    string    `json:"burial_date"`    // GEDCOM BURI/DATE
	BurialPlace   string    `json:"burial_place"`   // GEDCOM BURI/PLAC
	LivingCity    string    `json:"living_city"`    // GEDCOM RESI/PLAC (city part)
	LivingCountry string    `json:"living_country"` // GEDCOM RESI/PLAC (country part)
	Occupation    string    `json:"occupation"`     // GEDCOM OCCU
	Email         string    `json:"email"`          // GEDCOM EMAIL
	Phone         string    `json:"phone"`          // GEDCOM PHON
	Note          string    `json:"note"`
	PhotoKey      string    `json:"photo_key,omitempty"`
	PhotoURL      string    `json:"photo_url,omitempty"` // presigned URL, not stored in DB
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// Family represents a family unit (couple + children).
type Family struct {
	ID            string    `json:"id"`
	GedcomID      string    `json:"gedcom_id"`
	HusbandID     *string   `json:"husband_id"`
	WifeID        *string   `json:"wife_id"`
	MarriageDate  string    `json:"marriage_date"`
	MarriagePlace string    `json:"marriage_place"`
	DivorceDate   string    `json:"divorce_date"`
	Note          string    `json:"note"`
	ChildIDs      []string  `json:"child_ids"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// ChangeSet groups related mutations for history tracking.
type ChangeSet struct {
	ID          string    `json:"id"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

// GedcomFile tracks generated GEDCOM files stored in S3.
type GedcomFile struct {
	ID        string    `json:"id"`
	S3Key     string    `json:"s3_key"`
	Version   int       `json:"version"`
	CreatedAt time.Time `json:"created_at"`
}

// CreateIndividualRequest is the payload for creating/updating an individual.
type CreateIndividualRequest struct {
	GivenName     string `json:"given_name" validate:"required"`
	Surname       string `json:"surname" validate:"required"`
	NamePrefix    string `json:"name_prefix"`
	NameSuffix    string `json:"name_suffix"`
	Nickname      string `json:"nickname"`
	Sex           string `json:"sex" validate:"required,oneof=M F U"`
	BirthDate     string `json:"birth_date"`
	BirthPlace    string `json:"birth_place"`
	DeathDate     string `json:"death_date"`
	DeathPlace    string `json:"death_place"`
	BurialDate    string `json:"burial_date"`
	BurialPlace   string `json:"burial_place"`
	LivingCity    string `json:"living_city"`
	LivingCountry string `json:"living_country"`
	Occupation    string `json:"occupation"`
	Email         string `json:"email"`
	Phone         string `json:"phone"`
	Note          string `json:"note"`
}

// CreateFamilyRequest is the payload for creating/updating a family.
type CreateFamilyRequest struct {
	HusbandID     *string  `json:"husband_id"`
	WifeID        *string  `json:"wife_id"`
	MarriageDate  string   `json:"marriage_date"`
	MarriagePlace string   `json:"marriage_place"`
	DivorceDate   string   `json:"divorce_date"`
	Note          string   `json:"note"`
	ChildIDs      []string `json:"child_ids"`
}

// LoginRequest is the payload for the login endpoint.
type LoginRequest struct {
	Password string `json:"password" validate:"required"`
}

// LoginResponse is returned on successful login.
type LoginResponse struct {
	Token string `json:"token"`
}
