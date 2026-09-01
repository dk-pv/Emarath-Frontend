"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { GoogleMap, MarkerF, useJsApiLoader } from "@react-google-maps/api";
import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconRefresh,
} from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { env } from "@/lib/env";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  SegmentedControl,
  type SegmentedOption,
} from "@/components/ui/SegmentedControl";
import { Spinner } from "@/components/ui/Spinner";
import { GpsLegend, PIN_COLORS } from "@/components/gps/gps-legend";
import type { GpsPinRecord } from "@/services/gps-service";

// Kozhikode — the region Workpex centres on; used until pins arrive to fit to.
const DEFAULT_CENTER = { lat: 11.2588, lng: 75.7804 };
const DEFAULT_ZOOM = 11;

const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: true,
  gestureHandling: "greedy",
  clickableIcons: false,
};

/** Google calls this global when it rejects the API key; it is not in the SDK types. */
declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

/**
 * A rejected API key is a property of the loaded Maps SDK, not of this component, and
 * Google raises it once per page load. Holding it in module scope means switching to the
 * list view and back does not forget it — component state reset on every remount, so the
 * map silently re-rendered as an empty grey box after the first toggle.
 */
let mapsAuthFailed = false;
const authListeners = new Set<() => void>();

if (typeof window !== "undefined") {
  const previous = window.gm_authFailure;
  window.gm_authFailure = () => {
    mapsAuthFailed = true;
    for (const listener of authListeners) listener();
    previous?.();
  };
}

function subscribeAuth(listener: () => void): () => void {
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}
const getAuthFailed = () => mapsAuthFailed;
/** The server never sees a Maps failure, so it always renders the map optimistically. */
const getAuthFailedServer = () => false;

type MapType = "roadmap" | "satellite";

const BASE_LAYERS: SegmentedOption<MapType>[] = [
  { value: "roadmap", label: "Map" },
  { value: "satellite", label: "Satellite" },
];

/** A filled circle in the pin's legend colour. Info windows/hover are deferred
 * (no populated-map screenshot to match), so the marker is presentational only. */
function pinIcon(type: GpsPinRecord["type"]): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: PIN_COLORS[type],
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 2,
    scale: 7,
  };
}

function formatAgo(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"} ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}

const OVERLAY_PILL =
  "flex h-control-sm items-center gap-2 rounded-control border border-hairline bg-surface px-3 text-sm text-ink shadow-sm";

/**
 * The interactive GPS map (GPS-05.1): pins for field activity, a Map/Satellite
 * toggle, a last-refreshed indicator with manual refresh, and fullscreen — per
 * ui-reference/gps-map/gps-map-map-view-zero-state-no-markers.png and
 * GPS-MAP-overview.mp4. Auto-refresh is driven by the parent's `reloadToken`;
 * this view only reports when it last reloaded and offers a manual refresh.
 */
export function GpsMapView({
  locations,
  isLoading,
  refreshedAt,
  onRefresh,
}: {
  /** Shared with the list view (GPS-06.1) so both reflect the same fetch. */
  locations: GpsPinRecord[];
  isLoading: boolean;
  /** When the parent last triggered a refresh — drives the "Last Refreshed" pill. */
  refreshedAt: number;
  onRefresh: () => void;
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: "gps-map-loader",
    googleMapsApiKey: env.googleMapsApiKey,
  });

  // `useJsApiLoader` resolves `isLoaded: true` with no `loadError` even when Google
  // rejects the key, so this global is the only signal that the map will never draw.
  const authFailed = useSyncExternalStore(
    subscribeAuth,
    getAuthFailed,
    getAuthFailedServer,
  );

  const [mapType, setMapType] = useState<MapType>("roadmap");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onChange = () =>
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // ponytail: refits to all pins on every load — good enough for a supervision
  // map; add "follow one agent" only if a task asks for it.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || locations.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    for (const pin of locations) bounds.extend({ lat: pin.lat, lng: pin.lng });
    map.fitBounds(bounds);
  }, [locations]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void containerRef.current?.requestFullscreen();
  };

  const center = useMemo(() => DEFAULT_CENTER, []);

  if (!env.googleMapsApiKey || loadError || authFailed) {
    // The map is the only thing lost: the toolbar, filters, list and export keep
    // working, so a key problem degrades this panel rather than the screen.
    const description = !env.googleMapsApiKey
      ? "The Google Maps API key is not configured for this environment."
      : authFailed
        ? "Google rejected the Maps API key for this site. Check that the key is valid, that the Maps JavaScript API is enabled and billed on its project, and that this origin is allowed."
        : "The map failed to load. Check your connection and try again.";
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div
          data-map-shell
          className="flex min-h-[26rem] flex-1 items-center justify-center rounded-surface border border-hairline bg-canvas"
        >
          <ErrorState
            title="Map unavailable"
            description={description}
            onRetry={onRefresh}
          />
        </div>
        <GpsLegend />
      </div>
    );
  }

  return (
    // The map grows into whatever height the screen has left, as the reference's
    // does — the 26rem floor keeps it usable when the viewport is short.
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={containerRef}
        data-map-shell
        className={cn(
          "relative overflow-hidden rounded-surface border border-hairline bg-canvas",
          isFullscreen
            ? "h-screen rounded-none border-0"
            : "min-h-[26rem] flex-1",
        )}
      >
        {!isLoaded ? (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-ink-muted">
            <Spinner size="lg" label="" />
            <p className="text-sm">Loading map…</p>
          </div>
        ) : (
          <GoogleMap
            // inset-0, not size-full: the wrapper's height comes from `min-height`
            // when the column is unconstrained (tablet/mobile), and a percentage
            // height cannot resolve against that — the map collapsed to 0 there.
            mapContainerClassName="absolute inset-0"
            center={center}
            zoom={DEFAULT_ZOOM}
            mapTypeId={mapType}
            options={MAP_OPTIONS}
            onLoad={(map) => {
              mapRef.current = map;
            }}
            onUnmount={() => {
              mapRef.current = null;
            }}
          >
            {locations.map((pin) => (
              <MarkerF
                key={pin.id}
                position={{ lat: pin.lat, lng: pin.lng }}
                icon={pinIcon(pin.type)}
              />
            ))}
          </GoogleMap>
        )}

        {/* Map / Satellite base-layer toggle (AC2), top-left. */}
        <SegmentedControl
          aria-label="Base layer"
          options={BASE_LAYERS}
          value={mapType}
          onChange={setMapType}
          variant="subtle"
          className="absolute top-4 left-4 z-10 shadow-sm"
        />

        {/* Last-refreshed indicator + manual refresh (AC3/AC4) and fullscreen (AC5). */}
        <div className="absolute top-4 right-4 z-10 flex max-w-[calc(100%-11rem)] items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className={cn(OVERLAY_PILL, "focus-ring hover:bg-canvas")}
          >
            <IconRefresh
              size={16}
              stroke={1.75}
              aria-hidden="true"
              className={cn(isLoading && "animate-spin")}
            />
            {/* The "Last Refreshed" prefix is dropped on narrow screens so this pill
                cannot grow across the map and cover the base-layer toggle; the time
                itself — the part that carries the information — always stays. */}
            <span className="hidden sm:inline">Last Refreshed&nbsp;</span>
            {formatAgo(now - refreshedAt)}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            className={cn(
              OVERLAY_PILL,
              "focus-ring aspect-square justify-center px-0 hover:bg-canvas",
            )}
          >
            {isFullscreen ? (
              <IconArrowsMinimize size={16} stroke={1.75} aria-hidden="true" />
            ) : (
              <IconArrowsMaximize size={16} stroke={1.75} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {!isFullscreen && <GpsLegend />}
    </div>
  );
}
