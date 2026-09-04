package main

import (
	"fmt"
	"strings"
)

func normalizeCourierType(company, svcType string) string {
	c := strings.ToLower(strings.TrimSpace(company))
	s := strings.ToLower(strings.TrimSpace(svcType))

	// Clean courier names to match Biteship's internal code keys
	if strings.Contains(c, "jnt") || strings.Contains(c, "j&t") { c = "jnt" }
	if strings.Contains(c, "sicepat") { c = "sicepat" }
	if strings.Contains(c, "anteraja") { c = "anteraja" }
	if strings.Contains(c, "pos") { c = "pos" }
	if strings.Contains(c, "ninja") { c = "ninja" }
	if strings.Contains(c, "lion") { c = "lion" }
	if strings.Contains(c, "ide") || strings.Contains(c, "id express") { c = "idexpress" }
	if strings.Contains(c, "sap") { c = "sap" }
	if strings.Contains(c, "wahana") { c = "wahana" }
	if strings.Contains(c, "rpx") { c = "rpx" }

	validServices := map[string][]string{
		"gojek":        {"instant", "same_day"},
		"grab":         {"instant", "same_day", "instant_car"},
		"deliveree":    {"tronton_wing_box", "tronton_box", "fuso_heavy", "fuso_light", "cdd_box", "cdd_pickup", "cde_frozen", "cde_flammable", "cde_chemical", "engkel_box", "engkel_pickup", "small_box", "small_pickup", "van", "economy"},
		"jne":          {"reg", "yes", "oke", "jtr", "jtr_150_250", "jtr_150", "jtr_250"},
		"tiki":         {"eko", "sds", "reg", "ons", "t15", "t25", "t60", "trc"},
		"ninja":        {"standard"},
		"lion":         {"reg_pack", "big_pack"},
		"sicepat":      {"reg", "best", "gokil"},
		"sentralcargo": {"land_electronic", "land_non_electronic", "air_electronic", "air_non_electronic"},
		"jnt":          {"ez"},
		"idexpress":    {"reg_half_kilo", "reg", "idtruck"},
		"rpx":          {"sdp", "mdp", "ndp", "rgp", "pas", "ecp", "hwp"},
		"wahana":       {"deno"},
		"pos":          {"sameday", "nextday", "reg", "cargo"},
		"tlx":          {"international_standard"},
		"jntcargo":     {"ft"},
		"anteraja":     {"reg", "same_day"},
		"sap":          {"reg", "reg_half_kilo", "ods", "sds", "cargo"},
		"paxel":        {"small", "medium", "large", "paxel_big"},
		"borzo":        {"instant_bike", "instant_car"},
		"lalamove":     {"motorcycle", "mpv", "van", "truck", "cdd_bak", "cdd_box", "engkel_bak", "engkel_box"},
		"dash_express": {"same_day"},
	}

	switch c {
	case "jnt":
		if s == "reguler" || s == "reg" { s = "ez" }
	case "sicepat":
		if s == "reguler" || s == "siunt" { s = "reg" }
	case "pos":
		if s == "posreg" || s == "reguler" || s == "pos" { s = "reg" }
	case "wahana":
		if s == "reguler" || s == "reg" { s = "deno" }
	case "lion":
		if s == "reguler" || s == "reg" { s = "reg_pack" }
	case "rpx":
		if s == "reguler" || s == "reg" { s = "rgp" }
	case "ninja":
		if s == "reguler" || s == "reg" { s = "standard" }
	case "jne", "tiki", "anteraja", "idexpress", "sap":
		if s == "reguler" { s = "reg" }
	}

	if allowed, ok := validServices[c]; ok {
		for _, valid := range allowed {
			if s == strings.ToLower(valid) {
				return s
			}
		}
		if len(allowed) > 0 {
			if c == "jnt" { return "ez" }
			if c == "ninja" { return "standard" }
			if c == "wahana" { return "deno" }
			if c == "lion" { return "reg_pack" }
			if c == "rpx" { return "rgp" }
			if c == "jntcargo" { return "ft" }
			for _, v := range allowed {
				if v == "reg" { return "reg" }
			}
			return allowed[0]
		}
	}

	if s == "reguler" || s == "" {
		return "reg"
	}
	return s
}

func main() {
	fmt.Println("Result:", normalizeCourierType("POS Indonesia", "POS"))
}
