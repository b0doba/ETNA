import React, { useRef, useState, useEffect } from "react";

const LocateMeButton = ({ map }) => {
  const markerRef = useRef(null);
  const watchIdRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [tracking, setTracking] = useState(false);
  const hasCenteredRef = useRef(false); // csak egyszer központosítunk

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
          strokeWeight: 2,
        },
      });
    } else {
      markerRef.current.setPosition(latLng);
      markerRef.current.setMap(map);
    }
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // marker elrejtése
    if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }

    hasCenteredRef.current = false;
    setTracking(false);
    setLoading(false);
  };

  const handleClick = () => {
    if (!map) return;

    // ha már követ, második kattintás: leállítás + marker eltűnik
    if (tracking) {
      stopTracking();
      return;
    }

    if (!("geolocation" in navigator)) {
      alert("A böngésződ nem támogatja a helymeghatározást.");
      return;
    }

    setLoading(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const latLng = { lat: latitude, lng: longitude };

        placeOrMoveMarker(latLng);

        // 🔹 Csak AZ ELSŐ alkalommal zoomolunk / központosítunk
        if (!hasCenteredRef.current) {
          const currentZoom = map.getZoom() || 18;
          const targetZoom = Math.max(currentZoom, 18);
          map.panTo(latLng);
          if (currentZoom < 18) map.setZoom(targetZoom);
          hasCenteredRef.current = true;
        }

        setLoading(false);
        setTracking(true);
      },
      (err) => {
        let msg = "Nem sikerült lekérni a pozíciót.";
        if (err.code === err.PERMISSION_DENIED)
          msg = "Hozzáférés megtagadva. Engedélyezd a helymeghatározást.";
        else if (err.code === err.POSITION_UNAVAILABLE)
          msg = "A helyzet nem elérhető.";
        else if (err.code === err.TIMEOUT)
          msg = "Időtúllépés történt.";

        alert(msg);
        stopTracking();
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0,
      }
    );
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return (
    <button
      className={`locate-me-btn ${tracking ? "locate-me-btn--active" : ""}`}
      onClick={handleClick}
      disabled={!map || loading}
      title={
        loading
          ? "Pozíció lekérése..."
          : tracking
          ? "Követés leállítása"
          : "Jelenlegi hely folyamatos követése"
      }
      aria-label={
        tracking
          ? "Helykövetés leállítása"
          : "Jelenlegi hely folyamatos követése"
      }
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M11 3v2a7 7 0 0 0-6 6H3v2h2a7 7 0 0 0 6 6v2h2v-2a7 7 0 0 0 6-6h2v-2h-2a7 7 0 0 0-6-6V3h-2Zm1 4a5 5 0 1 1 0 10A5 5 0 0 1 12 7Z" />
        <circle cx="12" cy="12" r="1.7" />
      </svg>
    </button>
  );
};

export default LocateMeButton;
