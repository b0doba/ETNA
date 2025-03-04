import React, { useRef, useEffect, useState } from "react";

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_API_KEY;
const API_BASE_URL = "http://localhost:5000/api";

// Google Maps API betöltése
const loadGoogleMapsScript = () => {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      resolve();
      return;
    }

    if (document.getElementById("google-maps-script")) {
      document.getElementById("google-maps-script").addEventListener("load", resolve);
      document.getElementById("google-maps-script").addEventListener("error", () =>
        reject(new Error("Google Maps API betöltési hiba."))
      );
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry,places,drawing`;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Google Maps API betöltési hiba."));
    document.body.appendChild(script);
  });
};

// API-ból GeoJSON adatok lekérése
const fetchGeoJSON = async (url) => {
  try {
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    console.error(`Hiba az adatok lekérésekor (${url}):`, error);
    return { type: "FeatureCollection", features: [] };
  }
};

const AdminMap = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const drawingManager = useRef(null);
  const selectedFeature = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initMap = async () => {
      try {
        await loadGoogleMapsScript();
        const [buildings,floors, rooms] = await Promise.all([
          fetchGeoJSON(`${API_BASE_URL}/buildings`),
          fetchGeoJSON(`${API_BASE_URL}/floors`),
          fetchGeoJSON(`${API_BASE_URL}/rooms`),
        ]);

        if (!window.google || !window.google.maps) {
          throw new Error("Google Maps API nem érhető el.");
        }

        if (!mapContainer.current) {
          throw new Error("A térkép konténer nem található.");
        }

        map.current = new window.google.maps.Map(mapContainer.current, {
          center: { lat: 47.693344, lng: 17.627529 },
          zoom: 18,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          styles: [{ featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }],
        });

        // Drawing Manager inicializálása
        drawingManager.current = new window.google.maps.drawing.DrawingManager({
          drawingMode: null, // Alapból nem rajzolunk új objektumot
          drawingControl: true,
          drawingControlOptions: {
            position: window.google.maps.ControlPosition.TOP_LEFT,
            drawingModes: ["polygon"], // Csak poligonokat engedélyezünk
          },
          polygonOptions: {
            editable: true,
            draggable: true,
            fillColor: "blue",
            strokeColor: "black",
            strokeWeight: 2,
          },
        });

        drawingManager.current.setMap(map.current);

        // Létező épületek és szobák betöltése és szerkeszthetővé tétele
        const addGeoJSONToMap = (geoJson, color, type) => {
          geoJson.features.forEach((feature) => {
            const polygon = new window.google.maps.Polygon({
              paths: feature.geometry.coordinates[0].map(([lng, lat]) => ({ lat, lng })),
              editable: true,
              draggable: true,
              fillColor: color,
              strokeColor: "black",
              strokeWeight: 2,
            });

            polygon.setMap(map.current);

            //Kattintáskor az adott objektumot kiválasztjuk
            polygon.addListener("click", () => {
              selectedFeature.current = {
                id: feature.properties.id,
                polygon,
                type
              };
              console.log("📍 Kiválasztott objektum:", selectedFeature.current);
            });
          });
        };

        addGeoJSONToMap(buildings, "blue", "building");
        addGeoJSONToMap(floors, "green", "floor");
        addGeoJSONToMap(rooms, "red", "room");


        setLoading(false);
      } catch (err) {
        console.error(err);
        setError(err.message);
      }
    };

    initMap();
  }, []);

  //Kijelölt objektum mentése az API-ba
  async function saveUpdatedFeature() {
    if (!selectedFeature.current) {
      console.warn("❌ Nincs kiválasztott objektum!");
      return;
    }
  
    let coordinates = selectedFeature.current.polygon
      .getPath()
      .getArray()
      .map((latLng) => [latLng.lng(), latLng.lat()]);
  
    // Ha az első és utolsó koordináta nem azonos, zárjuk le a poligont
    if (
      coordinates.length > 1 &&
      (coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
        coordinates[0][1] !== coordinates[coordinates.length - 1][1])
    ) {
      console.log("Poligon lezárása...");
      coordinates.push([...coordinates[0]]); // Az első koordinátát az utolsó helyére másoljuk
    }
  
    const updatedFeature = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [coordinates],
          },
          properties: {
            id: selectedFeature.current.id,
          },
        },
      ],
    };
  
    console.log("Mentésre kerül:", JSON.stringify(updatedFeature, null, 2));
  
    let endpoint;
    switch (selectedFeature.current.type) {
      case "building":
        endpoint = `${API_BASE_URL}/updateBuildings`;
        break;
      case "floor":
        endpoint = `${API_BASE_URL}/updateFloors`;
        break;
      case "room":
        endpoint = `${API_BASE_URL}/updateRooms`;
        break;
      default:
        console.error("Ismeretlen típusú objektum!", selectedFeature.current);
        return;
    }
  
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedFeature),
    });
  
    console.log("✅ Mentés sikeres!");
    selectedFeature.current = null;
  }
  

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      {loading && <p>Betöltés...</p>}
      {error && <p style={{ color: "red" }}>Hiba történt: {error}</p>}
      <button
        onClick={saveUpdatedFeature}
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          zIndex: 1000,
          padding: "10px",
          backgroundColor: "green",
          color: "white",
          border: "none",
          cursor: "pointer",
        }}
      >
        Kijelölt objektum mentése
      </button>
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
    </div>
  );
};

export default AdminMap;
