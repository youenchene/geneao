package gedcom

import (
	"context"
	"fmt"
	"log"
	"regexp"
	"strings"

	"github.com/youenchene/geneao/backend/internal/model"
	"github.com/youenchene/geneao/backend/internal/repository"
)

// gedLine represents a parsed GEDCOM line.
type gedLine struct {
	Level int
	Xref  string // e.g. "@I1@"
	Tag   string // e.g. "INDI", "NAME", "BIRT"
	Value string // the rest of the line
}

var lineRegex = regexp.MustCompile(`^(\d+)\s+(@[^@]+@\s+)?(\S+)(\s+(.*))?$`)

func parseLines(text string) []gedLine {
	var lines []gedLine
	for _, raw := range strings.Split(text, "\n") {
		raw = strings.TrimSpace(raw)
		if raw == "" {
			continue
		}
		m := lineRegex.FindStringSubmatch(raw)
		if m == nil {
			continue
		}
		level := 0
		fmt.Sscanf(m[1], "%d", &level)
		xref := strings.TrimSpace(m[2])
		tag := m[3]
		value := ""
		if len(m) > 5 {
			value = strings.TrimSpace(m[5])
		}
		lines = append(lines, gedLine{Level: level, Xref: xref, Tag: tag, Value: value})
	}
	return lines
}

// parsedIndi holds parsed individual data with GEDCOM xref.
type parsedIndi struct {
	Xref          string
	GivenName     string
	Surname       string
	NamePrefix    string
	NameSuffix    string
	Nickname      string
	Sex           string
	BirthDate     string
	BirthPlace    string
	DeathDate     string
	DeathPlace    string
	BurialDate    string
	BurialPlace   string
	LivingCity    string
	LivingCountry string
	Occupation    string
	Email         string
	Phone         string
	Note          string
}

// splitPlace splits a GEDCOM PLAC value like "City, Country" on the first comma
// into (city, country). Values with no comma go entirely into the city part.
func splitPlace(plac string) (city, country string) {
	idx := strings.Index(plac, ",")
	if idx < 0 {
		return strings.TrimSpace(plac), ""
	}
	return strings.TrimSpace(plac[:idx]), strings.TrimSpace(plac[idx+1:])
}

// parsedFam holds parsed family data with GEDCOM xrefs.
type parsedFam struct {
	Xref          string
	HusbandXref   string
	WifeXref      string
	ChildXrefs    []string
	MarriageDate  string
	MarriagePlace string
	DivorceDate   string
	Note          string
}

// ParseText parses raw GEDCOM text into individuals and families.
func ParseText(text string) ([]parsedIndi, []parsedFam) {
	lines := parseLines(text)

	var indis []parsedIndi
	var fams []parsedFam

	i := 0
	for i < len(lines) {
		l := lines[i]
		if l.Level == 0 && l.Tag == "INDI" {
			indi := parsedIndi{Xref: l.Xref}
			i++
			var currentEvent string
			for i < len(lines) && lines[i].Level > 0 {
				sl := lines[i]
				switch {
				case sl.Level == 1 && sl.Tag == "NAME":
					// Parse "FirstName /LastName/" format
					name := sl.Value
					if idx := strings.Index(name, "/"); idx >= 0 {
						indi.GivenName = strings.TrimSpace(name[:idx])
						rest := name[idx+1:]
						if end := strings.Index(rest, "/"); end >= 0 {
							indi.Surname = strings.TrimSpace(rest[:end])
						}
					} else {
						indi.GivenName = name
					}
				case sl.Level == 2 && sl.Tag == "GIVN":
					indi.GivenName = sl.Value
				case sl.Level == 2 && sl.Tag == "SURN":
					indi.Surname = sl.Value
				case sl.Level == 2 && sl.Tag == "NPFX":
					indi.NamePrefix = sl.Value
				case sl.Level == 2 && sl.Tag == "NSFX":
					indi.NameSuffix = sl.Value
				case sl.Level == 2 && sl.Tag == "NICK":
					indi.Nickname = sl.Value
				case sl.Level == 1 && sl.Tag == "SEX":
					indi.Sex = sl.Value
				case sl.Level == 1 && sl.Tag == "BIRT":
					currentEvent = "BIRT"
				case sl.Level == 1 && sl.Tag == "DEAT":
					currentEvent = "DEAT"
				case sl.Level == 1 && sl.Tag == "BURI":
					currentEvent = "BURI"
				case sl.Level == 1 && sl.Tag == "RESI":
					currentEvent = "RESI"
				case sl.Level == 1 && sl.Tag == "OCCU":
					indi.Occupation = sl.Value
					currentEvent = ""
				case sl.Level == 1 && sl.Tag == "EMAIL":
					indi.Email = sl.Value
					currentEvent = ""
				case sl.Level == 1 && sl.Tag == "PHON":
					indi.Phone = sl.Value
					currentEvent = ""
				case sl.Level == 2 && sl.Tag == "DATE":
					switch currentEvent {
					case "BIRT":
						indi.BirthDate = sl.Value
					case "DEAT":
						indi.DeathDate = sl.Value
					case "BURI":
						indi.BurialDate = sl.Value
					}
				case sl.Level == 2 && sl.Tag == "PLAC":
					switch currentEvent {
					case "BIRT":
						indi.BirthPlace = sl.Value
					case "DEAT":
						indi.DeathPlace = sl.Value
					case "BURI":
						indi.BurialPlace = sl.Value
					case "RESI":
						indi.LivingCity, indi.LivingCountry = splitPlace(sl.Value)
					}
				case sl.Level == 1 && sl.Tag == "NOTE":
					indi.Note = sl.Value
				case sl.Level == 1:
					currentEvent = ""
				}
				i++
			}
			if indi.Sex == "" {
				indi.Sex = "U"
			}
			indis = append(indis, indi)
		} else if l.Level == 0 && l.Tag == "FAM" {
			fam := parsedFam{Xref: l.Xref}
			i++
			var currentEvent string
			for i < len(lines) && lines[i].Level > 0 {
				sl := lines[i]
				switch {
				case sl.Level == 1 && sl.Tag == "HUSB":
					fam.HusbandXref = sl.Value
				case sl.Level == 1 && sl.Tag == "WIFE":
					fam.WifeXref = sl.Value
				case sl.Level == 1 && sl.Tag == "CHIL":
					fam.ChildXrefs = append(fam.ChildXrefs, sl.Value)
				case sl.Level == 1 && sl.Tag == "MARR":
					currentEvent = "MARR"
				case sl.Level == 1 && sl.Tag == "DIV":
					currentEvent = "DIV"
				case sl.Level == 2 && sl.Tag == "DATE":
					if currentEvent == "MARR" {
						fam.MarriageDate = sl.Value
					} else if currentEvent == "DIV" {
						fam.DivorceDate = sl.Value
					}
				case sl.Level == 2 && sl.Tag == "PLAC":
					if currentEvent == "MARR" {
						fam.MarriagePlace = sl.Value
					}
				case sl.Level == 1 && sl.Tag == "NOTE":
					fam.Note = sl.Value
				case sl.Level == 1:
					currentEvent = ""
				}
				i++
			}
			fams = append(fams, fam)
		} else {
			i++
		}
	}

	return indis, fams
}

// ImportIntoDB parses GEDCOM text and creates all individuals and families in the database.
// Returns the count of imported individuals and families.
func ImportIntoDB(
	ctx context.Context,
	text string,
	individualRepo *repository.IndividualRepo,
	familyRepo *repository.FamilyRepo,
	changeSetRepo *repository.ChangeSetRepo,
) (int, int, error) {
	parsedIndis, parsedFams := ParseText(text)

	cs, err := changeSetRepo.Create(ctx, "GEDCOM import")
	if err != nil {
		return 0, 0, fmt.Errorf("create change set: %w", err)
	}

	// Map GEDCOM xref → DB UUID
	xrefToID := make(map[string]string)

	// 1. Create all individuals
	for _, pi := range parsedIndis {
		req := model.CreateIndividualRequest{
			GivenName:     pi.GivenName,
			Surname:       pi.Surname,
			NamePrefix:    pi.NamePrefix,
			NameSuffix:    pi.NameSuffix,
			Nickname:      pi.Nickname,
			Sex:           pi.Sex,
			BirthDate:     pi.BirthDate,
			BirthPlace:    pi.BirthPlace,
			DeathDate:     pi.DeathDate,
			DeathPlace:    pi.DeathPlace,
			BurialDate:    pi.BurialDate,
			BurialPlace:   pi.BurialPlace,
			LivingCity:    pi.LivingCity,
			LivingCountry: pi.LivingCountry,
			Occupation:    pi.Occupation,
			Email:         pi.Email,
			Phone:         pi.Phone,
			Note:          pi.Note,
		}
		indi, err := individualRepo.Create(ctx, req, cs.ID)
		if err != nil {
			return 0, 0, fmt.Errorf("create individual %s: %w", pi.Xref, err)
		}
		xrefToID[pi.Xref] = indi.ID
		log.Printf("Imported individual: %s %s (%s → %s)", pi.GivenName, pi.Surname, pi.Xref, indi.ID)
	}

	// 2. Create all families (linking by xref → UUID)
	for _, pf := range parsedFams {
		var husbandID, wifeID *string
		if id, ok := xrefToID[pf.HusbandXref]; ok {
			husbandID = &id
		}
		if id, ok := xrefToID[pf.WifeXref]; ok {
			wifeID = &id
		}
		// Deduplicate children (GEDCOM files can have duplicate CHIL refs)
		seenChildren := make(map[string]bool)
		var childIDs []string
		for _, cxref := range pf.ChildXrefs {
			if id, ok := xrefToID[cxref]; ok && !seenChildren[id] {
				seenChildren[id] = true
				childIDs = append(childIDs, id)
			}
		}

		req := model.CreateFamilyRequest{
			HusbandID:     husbandID,
			WifeID:        wifeID,
			ChildIDs:      childIDs,
			MarriageDate:  pf.MarriageDate,
			MarriagePlace: pf.MarriagePlace,
			DivorceDate:   pf.DivorceDate,
			Note:          pf.Note,
		}
		_, err := familyRepo.Create(ctx, req, cs.ID)
		if err != nil {
			return 0, 0, fmt.Errorf("create family %s: %w", pf.Xref, err)
		}
		log.Printf("Imported family: %s (H=%s W=%s children=%d)", pf.Xref, pf.HusbandXref, pf.WifeXref, len(childIDs))
	}

	return len(parsedIndis), len(parsedFams), nil
}
