package config

import (
	"time"
)

const (
	// DefaultStoreOriginAreaID represents Sleman, D.I. Yogyakarta in Biteship
	DefaultStoreOriginAreaID = "IDNP6IDNC419IDND3277IDZ55281"

	// DefaultActiveCouriers is the fallback courier list
	DefaultActiveCouriers = "jne,jnt,sicepat,anteraja,pos,tiki"

	// DefaultItemWeightGrams is the default product weight in grams
	DefaultItemWeightGrams = 250

	// RatesCacheTTL is the in-memory cache TTL for Biteship rates
	RatesCacheTTL = 30 * time.Minute

	// AreaCacheTTL is the in-memory cache TTL for Biteship Maps areas
	AreaCacheTTL = 24 * time.Hour
)
