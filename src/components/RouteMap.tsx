'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

const zoomControlStyles = `
.leaflet-control-zoom a {
  background-color: #1e1e2a !important;
  color: #e5e7eb !important;
  border-color: #2d2d3d !important;
}
.leaflet-control-zoom a:hover {
  background-color: #2d2d3d !important;
}
`;

// Decode Google-encoded polyline string into [lat, lng] pairs
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}

interface RouteMapProps {
  polyline: string;
  className?: string;
}

export function RouteMap({ polyline, className = '' }: RouteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const points = decodePolyline(polyline);
    if (points.length < 2) {
      setError(true);
      return;
    }

    // Dynamically import leaflet (SSR-safe)
    import('leaflet').then((L) => {
      if (!mapRef.current) return;

      const map = L.default.map(mapRef.current, {
        zoomControl: true,
        attributionControl: false,
        dragging: !L.default.Browser.mobile,
        scrollWheelZoom: false,
      });

      // Dark-themed tiles (CartoDB dark matter)
      L.default.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map);

      // Draw the route polyline
      const routeLine = L.default.polyline(points, {
        color: '#4aded4', // accentTeal
        weight: 3,
        opacity: 0.9,
        smoothFactor: 1,
      }).addTo(map);

      // Start marker (green dot)
      L.default.circleMarker(points[0], {
        radius: 6,
        fillColor: '#22c55e',
        fillOpacity: 1,
        color: '#fff',
        weight: 2,
      }).addTo(map);

      // End marker (red dot)
      L.default.circleMarker(points[points.length - 1], {
        radius: 6,
        fillColor: '#ef4444',
        fillOpacity: 1,
        color: '#fff',
        weight: 2,
      }).addTo(map);

      // Fit bounds with padding
      map.fitBounds(routeLine.getBounds(), { padding: [20, 20] });

      mapInstanceRef.current = map;
    }).catch(() => {
      setError(true);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [polyline]);

  if (error) return null;

  return (
    <div className={`bg-bgSecondary rounded-xl border border-borderPrimary overflow-hidden shadow-sm ${className}`}>
      <style>{zoomControlStyles}</style>
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <MapPin className="w-4 h-4 text-accentTeal" />
        <h3 className="text-sm font-semibold text-textPrimary">Route</h3>
      </div>
      <div
        ref={mapRef}
        className="h-[280px] w-full"
        style={{ background: '#121218' }}
      />
    </div>
  );
}
