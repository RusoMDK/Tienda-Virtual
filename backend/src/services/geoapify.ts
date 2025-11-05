// src/services/geoapify.ts
import axios from "axios";

const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY;
const GEOAPIFY_BASE_URL = "https://api.geoapify.com/v1";

if (!GEOAPIFY_API_KEY) {
  console.warn(
    "[geoapify] GEOAPIFY_API_KEY no está definida en .env. El servicio de mapas no funcionará."
  );
}

export type AddressSuggestion = {
  id: string;
  label: string;
  formatted: string;
  country: string | null;
  state: string | null;
  city: string | null;
  postcode: string | null;
  street: string | null;
  houseNumber: string | null;
  lat: number;
  lon: number;
  source: string;
};

export type GeocodeResult = {
  formatted: string;
  lat: number;
  lon: number;
  country: string | null;
  state: string | null;
  city: string | null;
  postcode: string | null;
  street: string | null;
  houseNumber: string | null;
  raw: any;
};

function mapFeatureToSuggestion(feature: any): AddressSuggestion | null {
  try {
    const props = feature.properties || {};
    return {
      id: String(
        props.place_id ??
          props.datasource?.raw?.osm_id ??
          props.placeId ??
          `${props.lat},${props.lon}`
      ),
      label:
        props.formatted || props.address_line1 || props.name || "Dirección",
      formatted: props.formatted || "",
      country: props.country || null,
      state: props.state || null,
      city: props.city || props.county || null,
      postcode: props.postcode || null,
      street: props.street || null,
      houseNumber: props.housenumber || null,
      lat: Number(props.lat),
      lon: Number(props.lon),
      source: "geoapify",
    };
  } catch {
    return null;
  }
}

function mapFeatureToGeocodeResult(feature: any): GeocodeResult {
  const props = feature.properties || {};
  return {
    formatted: props.formatted || "",
    lat: Number(props.lat),
    lon: Number(props.lon),
    country: props.country || null,
    state: props.state || null,
    city: props.city || props.county || null,
    postcode: props.postcode || null,
    street: props.street || null,
    houseNumber: props.housenumber || null,
    raw: props,
  };
}

/**
 * Autocomplete de direcciones/lugares, filtrado a Cuba.
 */
export async function geoapifyAutocomplete(
  text: string,
  limit: number = 5
): Promise<AddressSuggestion[]> {
  if (!GEOAPIFY_API_KEY) return [];

  const url = `${GEOAPIFY_BASE_URL}/geocode/autocomplete`;
  const { data } = await axios.get(url, {
    params: {
      text,
      apiKey: GEOAPIFY_API_KEY,
      format: "json",
      limit,
      lang: "es",
      filter: "countrycode:cu", // 🔒 Solo Cuba
    },
  });

  const features = data?.features || [];
  return features
    .map(mapFeatureToSuggestion)
    .filter((x: AddressSuggestion | null): x is AddressSuggestion => !!x);
}

/**
 * Geocodificación directa: texto → coords (Cuba).
 */
export async function geoapifyGeocode(
  text: string
): Promise<GeocodeResult | null> {
  if (!GEOAPIFY_API_KEY) return null;

  const url = `${GEOAPIFY_BASE_URL}/geocode/search`;
  const { data } = await axios.get(url, {
    params: {
      text,
      apiKey: GEOAPIFY_API_KEY,
      format: "json",
      limit: 1,
      lang: "es",
      filter: "countrycode:cu",
    },
  });

  const feature = data?.features?.[0];
  if (!feature) return null;
  return mapFeatureToGeocodeResult(feature);
}

/**
 * Reverse geocoding: coords → dirección (Cuba).
 */
export async function geoapifyReverseGeocode(
  lat: number,
  lon: number
): Promise<GeocodeResult | null> {
  if (!GEOAPIFY_API_KEY) return null;

  const url = `${GEOAPIFY_BASE_URL}/geocode/reverse`;
  const { data } = await axios.get(url, {
    params: {
      lat,
      lon,
      apiKey: GEOAPIFY_API_KEY,
      format: "json",
      limit: 1,
      lang: "es",
      filter: "countrycode:cu",
    },
  });

  const feature = data?.features?.[0];
  if (!feature) return null;
  return mapFeatureToGeocodeResult(feature);
}
