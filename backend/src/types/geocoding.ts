// src/types/geocoding.ts
export interface GeoSuggestion {
  id: string; // ID del proveedor (o hash interno)
  label: string; // Formato amigable para mostrar al usuario

  street?: string;
  houseNumber?: string;
  city?: string;
  municipality?: string;
  province?: string;
  country?: string;
  postcode?: string;

  lat: number;
  lng: number;

  // Por si quieres guardar info cruda
  raw?: any;
}
