import React, { useRef, useState } from "react";

const LocateMeButton = ({ map }) => {
  const markerRef = useRef(null);
  const [loading, setLoading] = useState(false);

  const placeOrMoveMarker = (latLng) => {
    if (!map || !window.google) return;
    if (!markerRef.current) {
      markerRef.current = new window.google.maps.Marker({
        position: latLng,
        map,
        clickable: false,
        zIndex: 9999,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 7,               
          fillColor: "#01acc8",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeOpacity: 1,
          strokeWeight: 2
        },
      });
    } else {
      markerRef.current.setPosition(latLng);
      markerRef.current.setMap(map);
    }
  };

  const handleClick = () => {
    if (!map) return;
    if (!("geolocation" in navigator)) {
      alert("A böngésződ nem támogatja a helymeghatározást.");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const latLng = { lat: latitude, lng: longitude };

        placeOrMoveMarker(latLng);

        // Finom ránézés a pontra (nem kötelező nagy közelítés)
        const targetZoom = Math.max(map.getZoom() || 18, 18);
        map.panTo(latLng);
        if (targetZoom < 18) map.setZoom(18);

        setLoading(false);
      },
      (err) => {
        setLoading(false);
        let msg = "Nem sikerült lekérni a pozíciót.";
        if (err.code === err.PERMISSION_DENIED)
          msg = "Hozzáférés megtagadva. Engedélyezd a helymeghatározást.";
        else if (err.code === err.POSITION_UNAVAILABLE)
          msg = "A helyzet nem elérhető.";
        else if (err.code === err.TIMEOUT)
          msg = "Időtúllépés történt.";
        alert(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0,
      }
    );
  };

  return (
    <button
      className="locate-me-btn"
      onClick={handleClick}
      disabled={!map || loading}
      title={loading ? "Pozíció lekérése..." : "Jelenlegi hely megjelenítése"}
      aria-label="Jelenlegi hely megjelenítése"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M11 3v2a7 7 0 0 0-6 6H3v2h2a7 7 0 0 0 6 6v2h2v-2a7 7 0 0 0 6-6h2v-2h-2a7 7 0 0 0-6-6V3h-2Zm1 4a5 5 0 1 1 0 10A5 5 0 0 1 12 7Z" />
        <circle cx="12" cy="12" r="1.7" />
      </svg>
    </button>
  );
};

export default LocateMeButton;
