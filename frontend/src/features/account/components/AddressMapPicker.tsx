import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMapEvents,
  LayersControl,
  LayerGroup,
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

// Limites del mapa (oeste hemisferio para que no se vea el mundo repetido)
const MAP_BOUNDS: [[number, number], [number, number]] = [
  [-10, -120], // Suroeste
  [50, -40], // Noreste
];

// ───────── Capas base (calles / satélite / relieve) ─────────
function BaseLayersControl() {
  return (
    <LayersControl position="bottomright">
      {/* Callejero principal */}
      <LayersControl.BaseLayer checked name="Mapa de calles">
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
      </LayersControl.BaseLayer>

      {/* Satélite + calles (Esri World Imagery + Transportation + Boundaries) */}
      <LayersControl.BaseLayer name="Satélite + calles (Esri)">
        <LayerGroup>
          <TileLayer
            attribution="Tiles &copy; Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
          <TileLayer
            attribution="Roads &copy; Esri, Garmin, HERE, & OpenStreetMap contributors"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
            opacity={0.9}
          />
          <TileLayer
            attribution="Boundaries & places &copy; Esri"
            url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
            opacity={0.9}
          />
        </LayerGroup>
      </LayersControl.BaseLayer>

      {/* Relieve / topográfico */}
      <LayersControl.BaseLayer name="Relieve / Topográfico">
        <TileLayer
          attribution="Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)"
          url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
          maxZoom={17}
        />
      </LayersControl.BaseLayer>
    </LayersControl>
  );
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

  // Estilos minimalistas para los controles nativos de Leaflet
  useEffect(() => {
    if (typeof document === "undefined") return;
    const styleId = "leaflet-minimal-controls-style";
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
      .leaflet-control-zoom,
      .leaflet-control-layers {
        border-radius: 9999px;
        background-color: rgba(15,23,42,0.82);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(148,163,184,0.55);
        box-shadow: 0 10px 28px rgba(15,23,42,0.7);
        overflow: hidden;
      }

      .leaflet-control-zoom a,
      .leaflet-control-layers-toggle {
        width: 26px;
        height: 26px;
        line-height: 26px;
        font-size: 13px;
        color: #e5e7eb;
        background-color: transparent;
      }

      .leaflet-control-zoom a:hover,
      .leaflet-control-layers-toggle:hover {
        background-color: rgba(15,23,42,0.9);
        color: #f9fafb;
      }

      .leaflet-control-layers-expanded {
        border-radius: 18px;
      }

      .leaflet-control-layers-list {
        padding: 6px 8px;
      }

      .leaflet-control-layers label {
        font-size: 11px;
        color: #e5e7eb;
      }
    `;
    document.head.appendChild(style);
  }, []);

  // Icono del marcador: foto del usuario o pin
  const markerIcon = useMemo(
    () =>
      L.divIcon({
        className: "",
        html: `
          <div style="
            width:28px;
            height:28px;
            border-radius:9999px;
            overflow:hidden;
            border:2px solid #10b981;
            box-shadow:0 6px 18px rgba(15,23,42,0.45);
            background:#10b981;
            display:flex;
            align-items:center;
            justify-content:center;
            color:#fff;
            font-size:13px;
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
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      }),
    [(user as any)?.avatarUrl]
  );

  // Si cambia el value externo (editar dirección), sincronizamos
  useEffect(() => {
    if (value?.lat != null && value?.lng != null) {
      setCenter([value.lat, value.lng]);
      setMarker([value.lat, value.lng]);
      setZoom(15);
      setLabel(value.label || "");
    }
  }, [value?.lat, value?.lng, value?.label]);

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
          params: { lat, lon: lng }, // backend espera "lon"
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

      console.log("Autocomplete /maps/autocomplete respuesta:", res.data);

      let raw: any[] = [];

      if (Array.isArray(res.data?.results)) {
        raw = res.data.results;
      } else if (Array.isArray(res.data?.features)) {
        raw = res.data.features;
      } else if (Array.isArray(res.data)) {
        raw = res.data;
      } else if (res.data?.result) {
        raw = [res.data.result];
      }

      const mapped: Suggestion[] = raw
        .map((r: any, idx: number) => {
          const props = r.properties || r;

          const latRaw =
            props.lat ??
            props.latitude ??
            r.lat ??
            r.geometry?.coordinates?.[1];
          const lngRaw =
            props.lon ??
            props.longitude ??
            r.lon ??
            r.geometry?.coordinates?.[0];

          const latNum = Number(latRaw);
          const lngNum = Number(lngRaw);

          const labelText =
            props.formatted ||
            props.label ||
            props.name ||
            `${Number.isFinite(latNum) ? latNum.toFixed(5) : ""}, ${
              Number.isFinite(lngNum) ? lngNum.toFixed(5) : ""
            }`;

          return {
            id:
              props.place_id?.toString() ||
              props.osm_id?.toString() ||
              `${latRaw},${lngRaw}` ||
              String(idx),
            label: labelText,
            lat: latNum,
            lng: lngNum,
          } as Suggestion;
        })
        .filter(
          (s) =>
            Number.isFinite(s.lat) &&
            !Number.isNaN(s.lat) &&
            Number.isFinite(s.lng) &&
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

        console.log("[Geoloc] coords:", {
          lat,
          lng,
          accuracy: pos.coords.accuracy,
        });

        applySelection(lat, lng, "Mi ubicación aproximada", true);
      },
      (err) => {
        console.error("Error geolocalización:", err);
        setLocating(false);
        toast({
          title: "No se pudo obtener tu ubicación",
          description: "Revisa los permisos del navegador.",
          variant: "error",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
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
          inline-flex items-center justify-center gap-1
          rounded-full bg-black/55 backdrop-blur-sm
          border border-white/10
          px-1.5 py-1 text-[10px] font-medium
          text-slate-50/90
          shadow-lg
          hover:bg-black/75 hover:text-white
          transition-colors transition-shadow
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
          absolute left-2 bottom-2 z-[600]
          inline-flex items-center justify-center gap-1
          rounded-full bg-black/55 backdrop-blur-sm
          border border-white/10
          px-2 py-1.5 text-[10px] font-medium
          text-slate-50/90
          shadow-lg
          hover:bg-black/75 hover:text-white
          disabled:opacity-60 disabled:cursor-not-allowed
          transition-colors transition-shadow
        "
      >
        <Crosshair size={14} />
        {locating ? "Ubicando…" : "Mi ubicación"}
      </button>

      <MapContainer
        center={center as any}
        zoom={zoom}
        minZoom={4}
        maxZoom={18}
        maxBounds={MAP_BOUNDS as any}
        maxBoundsViscosity={0.9}
        className="h-56 md:h-64 w-full rounded-xl border border-[rgb(var(--border-rgb))] overflow-hidden"
        scrollWheelZoom={false}
      >
        <BaseLayersControl />
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
    <div className="fixed inset-0 z-[2500] flex items-center justify-center bg-black/60 px-3">
      <div className="relative w-full max-w-5xl rounded-2xl bg-[rgb(var(--card-rgb))] border border-[rgb(var(--border-rgb))] shadow-2xl p-3 md:p-4">
        {/* Cerrar modal */}
        <button
          type="button"
          onClick={() => setFullscreen(false)}
          className="
            absolute right-3 top-3
            inline-flex h-7 w-7 items-center justify-center
            rounded-full bg-black/65 text-white/85
            hover:bg-black/85 hover:text-white
            shadow-md
            transition-colors
          "
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
            className="
              inline-flex items-center gap-1
              rounded-full border-[rgb(var(--border-rgb))]
              bg-transparent
              px-3 py-1.5 text-[11px] font-medium
              hover:bg-[rgb(var(--card-2-rgb))]
              disabled:opacity-60 disabled:cursor-not-allowed
            "
          >
            <Crosshair size={14} />
            {locating ? "Obteniendo ubicación…" : "Usar mi ubicación"}
          </Button>
        </div>

        <MapContainer
          center={center as any}
          zoom={zoom}
          minZoom={4}
          maxZoom={18}
          maxBounds={MAP_BOUNDS as any}
          maxBoundsViscosity={0.9}
          className="h-[70vh] w-full rounded-xl border border-[rgb(var(--border-rgb))] overflow-hidden"
          scrollWheelZoom
        >
          <BaseLayersControl />
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
          className="h-9 text-xs sm:text-sm rounded-full"
        />
        <Button
          type="submit"
          size="sm"
          disabled={loadingSearch}
          className="
            h-9 px-3 text-xs font-medium
            rounded-full
            shadow-sm
          "
        >
          {loadingSearch ? "Buscando…" : "Buscar"}
        </Button>
      </form>

      {/* Resultados */}
      {suggestions.length > 0 && (
        <div className="max-h-40 overflow-auto rounded-xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] text-xs">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleSelectSuggestion(s)}
              className="
                block w-full px-3 py-2 text-left
                hover:bg-[rgb(var(--card-2-rgb))]
                transition-colors
              "
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Mapa pequeño */}
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
