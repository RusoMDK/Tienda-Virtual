// src/features/account/components/AddressMapPicker.tsx
import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { Input, Button, useToast } from "@/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Maximize2, X, Crosshair } from "lucide-react";

type AddressMapPickerProps = {
  value?: {
    lat: number;
    lng: number;
    label?: string;
  };
  onChange?: (next: { lat: number; lng: number; label?: string }) => void;
};

type Suggestion = {
  id: string;
  label: string;
  lat: number;
  lng: number;
};

function MapClickHandler({
  onSelect,
}: {
  onSelect: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function AddressMapPicker({
  value,
  onChange,
}: AddressMapPickerProps) {
  const toast = useToast();
  const { user } = useAuth();

  // Centro inicial: Cuba
  const defaultCenter: [number, number] = [21.5, -79.5];

  const [center, setCenter] = useState<[number, number]>(
    value ? [value.lat, value.lng] : defaultCenter
  );
  const [zoom, setZoom] = useState(value ? 15 : 6);
  const [marker, setMarker] = useState<[number, number] | null>(
    value ? [value.lat, value.lng] : null
  );
  const [label, setLabel] = useState(value?.label || "");

  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [locating, setLocating] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // Si cambia el value externo (editar dirección), sincronizamos
  useEffect(() => {
    if (value?.lat != null && value?.lng != null) {
      setCenter([value.lat, value.lng]);
      setMarker([value.lat, value.lng]);
      setZoom(15);
      setLabel(value.label || "");
    }
  }, [value?.lat, value?.lng, value?.label]);

  // Icono del marcador: foto del usuario o pin
  const markerIcon = useMemo(
    () =>
      L.divIcon({
        className: "",
        html: `
          <div style="
            width:32px;
            height:32px;
            border-radius:9999px;
            overflow:hidden;
            border:2px solid #10b981;
            box-shadow:0 6px 16px rgba(15,23,42,0.35);
            background:#10b981;
            display:flex;
            align-items:center;
            justify-content:center;
            color:#fff;
            font-size:14px;
          ">
            ${
              (user as any)?.avatarUrl
                ? `<img src="${
                    (user as any).avatarUrl
                  }" alt="user" style="width:100%;height:100%;object-fit:cover;" />`
                : "📍"
            }
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      }),
    [(user as any)?.avatarUrl]
  );

  // ───────── Helpers ─────────
  function applySelection(
    lat: number,
    lng: number,
    fromLabel?: string,
    doReverse: boolean = false
  ) {
    setCenter([lat, lng]);
    setMarker([lat, lng]);
    setZoom(16);

    if (fromLabel) {
      setLabel(fromLabel);
      onChange?.({ lat, lng, label: fromLabel });
      return;
    }

    if (!doReverse) {
      const lbl = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setLabel(lbl);
      onChange?.({ lat, lng, label: lbl });
      return;
    }

    // Reverse geocoding vía backend
    (async () => {
      try {
        const res = await api.get("/maps/reverse", {
          params: { lat, lon: lng }, // 🔧 backend espera "lon"
        });
        const lbl =
          res.data?.label ||
          res.data?.formatted ||
          `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        setLabel(lbl);
        onChange?.({ lat, lng, label: lbl });
      } catch {
        const lbl = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        setLabel(lbl);
        onChange?.({ lat, lng, label: lbl });
      }
    })();
  }

  // ───────── BÚSQUEDA ─────────
  async function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;

    try {
      setLoadingSearch(true);
      setSuggestions([]);

      const res = await api.get("/maps/autocomplete", {
        params: { text: q, limit: 6 },
      });

      const raw =
        Array.isArray(res.data?.results) && res.data.results.length
          ? res.data.results
          : Array.isArray(res.data?.features)
          ? res.data.features
          : [];

      const mapped: Suggestion[] = raw
        .map((r: any, idx: number) => {
          const props = r.properties || r;
          const lat =
            props.lat ??
            props.latitude ??
            r.lat ??
            r.geometry?.coordinates?.[1];
          const lng =
            props.lon ??
            props.longitude ??
            r.lon ??
            r.geometry?.coordinates?.[0];

          const labelText =
            props.formatted ||
            props.label ||
            props.name ||
            `${lat?.toFixed?.(5) || ""}, ${lng?.toFixed?.(5) || ""}`;

          return {
            id:
              props.place_id?.toString() ||
              props.osm_id?.toString() ||
              `${lat},${lng}` ||
              String(idx),
            label: labelText,
            lat,
            lng,
          } as Suggestion;
        })
        .filter(
          (s) =>
            typeof s.lat === "number" &&
            !Number.isNaN(s.lat) &&
            typeof s.lng === "number" &&
            !Number.isNaN(s.lng)
        );

      if (!mapped.length) {
        toast({
          title: "Sin resultados",
          description: "No encontramos esa dirección, prueba con otra.",
          variant: "warning",
        });
      }

      setSuggestions(mapped);
    } catch (err) {
      console.error("Error buscando dirección", err);
      toast({
        title: "Error al buscar",
        description: "Inténtalo de nuevo en unos segundos.",
        variant: "error",
      });
    } finally {
      setLoadingSearch(false);
    }
  }

  async function handleSelectSuggestion(s: Suggestion) {
    applySelection(s.lat, s.lng, s.label, false);
    setSuggestions([]);
  }

  // ───────── CLICK EN MAPA ─────────
  function handleMapClick(lat: number, lng: number) {
    applySelection(lat, lng, undefined, true);
  }

  // ───────── GEOLOCALIZACIÓN (Mi ubicación) ─────────
  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocalización no disponible",
        description: "Tu navegador no permite obtener la ubicación.",
        variant: "warning",
      });
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        applySelection(lat, lng, "Mi ubicación aproximada", true);
      },
      (err) => {
        console.error(err);
        setLocating(false);
        toast({
          title: "No se pudo obtener tu ubicación",
          description: "Revisa los permisos del navegador.",
          variant: "error",
        });
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
      }
    );
  }

  // ───────── Mapa compacto ─────────
  const compactMap = (
    <div className="relative">
      {/* Botón ampliar */}
      <button
        type="button"
        onClick={() => setFullscreen(true)}
        className="
          absolute right-2 top-2 z-[600]
          inline-flex items-center gap-1 rounded-lg bg-[rgb(var(--card-rgb))]
          border border-[rgb(var(--border-rgb))]
          px-2 py-1 text-[11px] shadow-sm
          hover:bg-[rgb(var(--card-2-rgb))]
        "
      >
        <Maximize2 size={14} />
        <span className="hidden sm:inline">Ampliar</span>
      </button>

      {/* Botón mi ubicación (compacto) */}
      <button
        type="button"
        onClick={handleUseMyLocation}
        disabled={locating}
        className="
          absolute left-2 top-2 z-[600]
          inline-flex items-center gap-1.5
          rounded-full bg-[rgb(var(--card-rgb))]
          border border-[rgb(var(--border-rgb))]
          px-2 py-1.5 text-[11px] shadow-sm
          hover:bg-[rgb(var(--card-2-rgb))]
        "
      >
        <Crosshair size={14} />
        {locating ? "Ubicando…" : "Mi ubicación"}
      </button>

      <MapContainer
        center={center as any}
        zoom={zoom}
        className="h-64 w-full rounded-xl border border-[rgb(var(--border-rgb))] overflow-hidden"
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onSelect={handleMapClick} />
        {marker && (
          <Marker position={marker as any} icon={markerIcon}>
            <Popup>{label || "Ubicación seleccionada"}</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );

  // ───────── Mapa fullscreen ─────────
  const fullscreenNode = !fullscreen ? null : (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 px-3">
      <div className="relative w-full max-w-5xl rounded-2xl bg-[rgb(var(--card-rgb))] border border-[rgb(var(--border-rgb))] shadow-2xl p-3 md:p-4">
        {/* Cerrar modal */}
        <button
          type="button"
          onClick={() => setFullscreen(false)}
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/85"
        >
          <X size={16} />
        </button>

        <div className="mb-3 mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold">
            Buscar en el mapa (modo ampliado)
          </h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleUseMyLocation}
            disabled={locating}
            className="inline-flex items-center gap-1 text-xs self-start"
          >
            <Crosshair size={14} />
            {locating ? "Obteniendo ubicación…" : "Usar mi ubicación"}
          </Button>
        </div>

        <MapContainer
          center={center as any}
          zoom={zoom}
          className="h-[70vh] w-full rounded-xl border border-[rgb(var(--border-rgb))] overflow-hidden"
          scrollWheelZoom
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onSelect={handleMapClick} />
          {marker && (
            <Marker position={marker as any} icon={markerIcon}>
              <Popup>{label || "Ubicación seleccionada"}</Popup>
            </Marker>
          )}
        </MapContainer>

        {label && (
          <p className="mt-2 text-xs opacity-80">
            Punto seleccionado: <span className="font-medium">{label}</span>
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      {/* Buscador */}
      <form
        onSubmit={handleSearchSubmit}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar dirección, barrio, ciudad…"
          className="h-9 text-xs sm:text-sm"
        />
        <Button
          type="submit"
          size="sm"
          disabled={loadingSearch}
          className="whitespace-nowrap"
        >
          {loadingSearch ? "Buscando…" : "Buscar"}
        </Button>
      </form>

      {/* Resultados */}
      {suggestions.length > 0 && (
        <div className="max-h-40 overflow-auto rounded-lg border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] text-xs">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleSelectSuggestion(s)}
              className="block w-full px-3 py-2 text-left hover:bg-[rgb(var(--card-2-rgb))]"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Mapa pequeño (solo cuando no está en fullscreen) */}
      {!fullscreen && compactMap}

      {/* Mapa ampliado */}
      {fullscreenNode}

      {label && (
        <p className="text-[11px] opacity-75">
          Punto seleccionado: <span className="font-medium">{label}</span>. Se
          guardará cuando guardes esta dirección.
        </p>
      )}
    </div>
  );
}
