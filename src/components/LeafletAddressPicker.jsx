import { useEffect } from 'react'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'

const DEFAULT_CENTER = { lat: 11.5564, lng: 104.9282 }
const DEFAULT_ZOOM = 14

const leafletMarkerIcon = new L.Icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
})

L.Marker.prototype.options.icon = leafletMarkerIcon

function normalizeCoordinates(value) {
  const lat = Number(value?.lat)
  const lng = Number(value?.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

function MapClickHandler({ onPick }) {
  useMapEvents({
    click(event) {
      onPick({
        lat: Number(event.latlng.lat.toFixed(6)),
        lng: Number(event.latlng.lng.toFixed(6)),
      })
    },
  })
  return null
}

function RecenterMap({ coordinates }) {
  const map = useMap()
  useEffect(() => {
    const position = normalizeCoordinates(coordinates)
    if (!position) return
    map.flyTo(position, Math.max(15, map.getZoom()), { animate: true, duration: 0.8 })
  }, [coordinates, map])
  return null
}

export function LeafletAddressPicker({
  coordinates = null,
  onPickCoordinates,
  className = '',
}) {
  const safeCoordinates = normalizeCoordinates(coordinates)
  const center = safeCoordinates || DEFAULT_CENTER

  return (
    <div className={`eloise-map-shell ${className}`.trim()}>
      <MapContainer
        center={center}
        zoom={safeCoordinates ? DEFAULT_ZOOM : 12}
        scrollWheelZoom
        className="eloise-map-container"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onPick={onPickCoordinates} />
        <RecenterMap coordinates={safeCoordinates} />
        {safeCoordinates ? <Marker position={safeCoordinates} /> : null}
      </MapContainer>
    </div>
  )
}

export default LeafletAddressPicker
