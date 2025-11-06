// src/services/geoapify.ts
import axios from "axios";
import { env } from "../env";

const GEOAPIFY_KEY = env.GEOAPIFY_KEY ?? process.env.GEOAPIFY_API_KEY;
const GEOAPIFY_BASE_URL = "https://api.geoapify.com/v1";

if (!GEOAPIFY_KEY) {
  console.warn(
    "[geoapify] GEOAPIFY_KEY / GEOAPIFY_API_KEY no está definida en .env. El servicio de mapas no funcionará."
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

function getCity(props: any): string | null {
  return (
    props.city ??
    props.town ??
    props.village ??
    props.hamlet ??
    props.county ??
    null
  );
}

function extractLatLon(feature: any): { lat: number; lon: number } | null {
  const props = feature.properties || feature;

  const latRaw =
    props.lat ??
    props.latitude ??
    feature.lat ??
    feature.latitude ??
    feature.geometry?.coordinates?.[1];

  const lonRaw =
    props.lon ??
    props.longitude ??
    feature.lon ??
    feature.longitude ??
    feature.geometry?.coordinates?.[0];

  const lat = Number(latRaw);
  const lon = Number(lonRaw);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  return { lat, lon };
}

function mapFeatureToSuggestion(feature: any): AddressSuggestion | null {
  try {
    const props = feature.properties || feature;
    const coords = extractLatLon(feature);
    if (!coords) return null;

    return {
      id: String(
        props.place_id ??
          props.placeId ??
          props.datasource?.raw?.osm_id ??
          `${coords.lat},${coords.lon}`
      ),
      label:
        props.formatted || props.address_line1 || props.name || "Dirección",
      formatted: props.formatted || "",
      country: props.country || null,
      state: props.state || null,
      city: getCity(props),
      postcode: props.postcode || null,
      street: props.street || props.road || null,
      houseNumber: props.housenumber || props.house_number || null,
      lat: coords.lat,
      lon: coords.lon,
      source: "geoapify",
    };
  } catch {
    return null;
  }
}

function mapFeatureToGeocodeResult(feature: any): GeocodeResult {
  const props = feature.properties || feature;
  const coords = extractLatLon(feature) ?? { lat: NaN, lon: NaN };

  return {
    formatted: props.formatted || "",
    lat: coords.lat,
    lon: coords.lon,
    country: props.country || null,
    state: props.state || null,
    city: getCity(props),
    postcode: props.postcode || null,
    street: props.street || props.road || null,
    houseNumber: props.housenumber || props.house_number || null,
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
  if (!GEOAPIFY_KEY) return [];

  const url = `${GEOAPIFY_BASE_URL}/geocode/autocomplete`;

  const { data } = await axios.get(url, {
    params: {
      text,
      apiKey: GEOAPIFY_KEY,
      limit,
      lang: "es",
      filter: "countrycode:cu", // Solo Cuba
      // ⚠️ NO ponemos format=json para mantener GeoJSON (features)
    },
  });

  let raw: any[] = [];

  if (Array.isArray(data?.features)) {
    raw = data.features;
  } else if (Array.isArray(data?.results)) {
    // Por si alguien añade format=json en el futuro
    raw = data.results;
  }

  return raw
    .map(mapFeatureToSuggestion)
    .filter((x: AddressSuggestion | null): x is AddressSuggestion => !!x);
}

/**
 * Geocodificación directa: texto → coords (Cuba).
 */
export async function geoapifyGeocode(
  text: string
): Promise<GeocodeResult | null> {
  if (!GEOAPIFY_KEY) return null;

  const url = `${GEOAPIFY_BASE_URL}/geocode/search`;

  const { data } = await axios.get(url, {
    params: {
      text,
      apiKey: GEOAPIFY_KEY,
      limit: 1,
      lang: "es",
      filter: "countrycode:cu",
      // sin format=json → usamos data.features
    },
  });

  const feature =
    Array.isArray(data?.features) && data.features.length
      ? data.features[0]
      : Array.isArray(data?.results) && data.results.length
      ? data.results[0]
      : null;

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
  if (!GEOAPIFY_KEY) return null;

  const url = `${GEOAPIFY_BASE_URL}/geocode/reverse`;

  const { data } = await axios.get(url, {
    params: {
      lat,
      lon,
      apiKey: GEOAPIFY_KEY,
      limit: 1,
      lang: "es",
      filter: "countrycode:cu",
    },
  });

  const feature =
    Array.isArray(data?.features) && data.features.length
      ? data.features[0]
      : Array.isArray(data?.results) && data.results.length
      ? data.results[0]
      : null;

  if (!feature) return null;
  return mapFeatureToGeocodeResult(feature);
}
