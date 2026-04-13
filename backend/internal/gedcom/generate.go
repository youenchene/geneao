// Package gedcom generates GEDCOM 5.5.1 files from database entities.
package gedcom

import (
	"fmt"
	"strings"
	"time"

	"github.com/youenchene/geneao/backend/internal/model"
)

// Generate builds a GEDCOM 5.5.1 text from individuals and families.
func Generate(individuals []model.Individual, families []model.Family) string {
	var b strings.Builder

	// Header
	b.WriteString("0 HEAD\n")
	b.WriteString("1 SOUR Geneao\n")
	b.WriteString("2 VERS 2.0\n")
	b.WriteString("1 GEDC\n")
	b.WriteString("2 VERS 5.5.1\n")
	b.WriteString("2 FORM LINEAGE-LINKED\n")
	b.WriteString("1 CHAR UTF-8\n")
	b.WriteString(fmt.Sprintf("1 DATE %s\n", time.Now().Format("2 Jan 2006")))

	// Build family lookup: individual ID -> families as spouse
	spouseFams := make(map[string][]string)
	childFam := make(map[string]string)
	for fi, fam := range families {
		famTag := fmt.Sprintf("@F%d@", fi+1)
		if fam.HusbandID != nil {
			spouseFams[*fam.HusbandID] = append(spouseFams[*fam.HusbandID], famTag)
		}
		if fam.WifeID != nil {
			spouseFams[*fam.WifeID] = append(spouseFams[*fam.WifeID], famTag)
		}
		for _, cid := range fam.ChildIDs {
			childFam[cid] = famTag
		}
	}

	// Individuals
	indiTags := make(map[string]string)
	for i, indi := range individuals {
		tag := fmt.Sprintf("@I%d@", i+1)
		indiTags[indi.ID] = tag

		b.WriteString(fmt.Sprintf("0 %s INDI\n", tag))
		b.WriteString(fmt.Sprintf("1 NAME %s /%s/\n", indi.GivenName, indi.Surname))
		b.WriteString(fmt.Sprintf("2 GIVN %s\n", indi.GivenName))
		b.WriteString(fmt.Sprintf("2 SURN %s\n", indi.Surname))
		if indi.Sex != "" {
			b.WriteString(fmt.Sprintf("1 SEX %s\n", indi.Sex))
		}
		if indi.BirthDate != "" || indi.BirthPlace != "" {
			b.WriteString("1 BIRT\n")
			if indi.BirthDate != "" {
				b.WriteString(fmt.Sprintf("2 DATE %s\n", indi.BirthDate))
			}
			if indi.BirthPlace != "" {
				b.WriteString(fmt.Sprintf("2 PLAC %s\n", indi.BirthPlace))
			}
		}
		if indi.DeathDate != "" || indi.DeathPlace != "" {
			b.WriteString("1 DEAT\n")
			if indi.DeathDate != "" {
				b.WriteString(fmt.Sprintf("2 DATE %s\n", indi.DeathDate))
			}
			if indi.DeathPlace != "" {
				b.WriteString(fmt.Sprintf("2 PLAC %s\n", indi.DeathPlace))
			}
		}
		if indi.LivingPlace != "" {
			b.WriteString("1 RESI\n")
			b.WriteString(fmt.Sprintf("2 PLAC %s\n", indi.LivingPlace))
		}
		if indi.Note != "" {
			b.WriteString(fmt.Sprintf("1 NOTE %s\n", indi.Note))
		}
		for _, fTag := range spouseFams[indi.ID] {
			b.WriteString(fmt.Sprintf("1 FAMS %s\n", fTag))
		}
		if fTag, ok := childFam[indi.ID]; ok {
			b.WriteString(fmt.Sprintf("1 FAMC %s\n", fTag))
		}
	}

	// Families
	for fi, fam := range families {
		famTag := fmt.Sprintf("@F%d@", fi+1)
		b.WriteString(fmt.Sprintf("0 %s FAM\n", famTag))
		if fam.HusbandID != nil {
			if tag, ok := indiTags[*fam.HusbandID]; ok {
				b.WriteString(fmt.Sprintf("1 HUSB %s\n", tag))
			}
		}
		if fam.WifeID != nil {
			if tag, ok := indiTags[*fam.WifeID]; ok {
				b.WriteString(fmt.Sprintf("1 WIFE %s\n", tag))
			}
		}
		if fam.MarriageDate != "" || fam.MarriagePlace != "" {
			b.WriteString("1 MARR\n")
			if fam.MarriageDate != "" {
				b.WriteString(fmt.Sprintf("2 DATE %s\n", fam.MarriageDate))
			}
			if fam.MarriagePlace != "" {
				b.WriteString(fmt.Sprintf("2 PLAC %s\n", fam.MarriagePlace))
			}
		}
		if fam.DivorceDate != "" {
			b.WriteString("1 DIV\n")
			b.WriteString(fmt.Sprintf("2 DATE %s\n", fam.DivorceDate))
		}
		for _, cid := range fam.ChildIDs {
			if tag, ok := indiTags[cid]; ok {
				b.WriteString(fmt.Sprintf("1 CHIL %s\n", tag))
			}
		}
		if fam.Note != "" {
			b.WriteString(fmt.Sprintf("1 NOTE %s\n", fam.Note))
		}
	}

	// Trailer
	b.WriteString("0 TRLR\n")

	return b.String()
}
