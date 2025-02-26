import React, { useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SearchPanel from "./SearchPanel.js";

const GOOGLE_MAPS_API_KEY = "AIzaSyBWeYuU1qGCrmqjhMElUU8Vtn1SkKF0kE8"; // 🔹 Cseréld ki a saját Google Maps API kulcsodra

// Google Maps API betöltése biztos módon
const loadGoogleMapsScript = () => {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      console.log("Google Maps API már betöltve.");
      resolve();
      return;
    }

    const existingScript = document.getElementById("google-maps-script");
    if (existingScript) {
      existingScript.addEventListener("load", resolve);
      existingScript.addEventListener("error", () => reject(new Error("Google Maps API betöltési hiba.")));
      return;
    }

    console.log("Google Maps API betöltése...");

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&callback=initGoogleMaps`;
    script.async = true;
    script.onerror = () => reject(new Error("Google Maps API betöltési hiba."));
    document.body.appendChild(script);

    window.initGoogleMaps = () => {
      console.log("Google Maps API sikeresen betöltődött.");
      resolve();
    };
  });
};

const fetchGeoJSON = async (url) => {
  try {
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    console.error(`Hiba az adatok lekérésekor (${url}):`, error);
    return { type: "FeatureCollection", features: [] };
  }
};

const MapComponent = () => {
  const navigate = useNavigate();
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initMap = async () => {
      try {
        await loadGoogleMapsScript();
        const [buildings,floors, rooms] = await Promise.all([
          fetchGeoJSON("http://localhost:5000/api/buildings"),
          fetchGeoJSON("http://localhost:5000/api/rooms"),
          fetchGeoJSON("http://localhost:5000/api/floors")
        ]);

        if (!window.google || !window.google.maps) {
          throw new Error("Google Maps API nem érhető el.");
        }

        if (!mapContainer.current) {
          throw new Error("A térkép konténer nem található.");
        }

        console.log("Térkép inicializálása...");

        map.current = new window.google.maps.Map(mapContainer.current, {
          center: { lat: 47.693344, lng: 17.627529 },
          zoom: 18,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          styles: [
            {
              featureType: "poi",
              elementType: "labels",
              stylers: [{ visibility: "off" }],
            },
          ],
        });

        const addGeoJSONToMap = (geoJson, type) => {
          map.current.data.addGeoJson(geoJson);
        
          map.current.data.setStyle((feature) => {
            const category = feature.getProperty("category"); // 🔹 Ellenőrizzük a "category" mezőt
            let fillColor = "gray"; // 🔹 Alapértelmezett szín
        
            if (category === "building") fillColor = "blue";
            else if (category === "floor") fillColor = "green";
            else if (category === "room") fillColor = "red";
        
            return {
              fillColor: fillColor,
              strokeColor: "black",
              strokeWeight: 1,
            };
          });
        };

        addGeoJSONToMap(buildings, "building");
        addGeoJSONToMap(floors, "floor");
        addGeoJSONToMap(rooms,"room");

        // 🔹 Egyedi InfoWindow létrehozása
      const infoWindow = new window.google.maps.InfoWindow();

      map.current.data.addListener("mouseover", (event) => {
        const category = event.feature.getProperty("category") || "Ismeretlen";
        let displayText = event.feature.getProperty("name") || "Nincs név"; // Alapértelmezett

        // 🔹 Ha az objektum egy "floor", akkor a "number" értéket használjuk
        if (category === "floor") {
          displayText = `Emelet: ${event.feature.getProperty("number")}`;
        }

        const content = `
          <div class="custom-info-window">
            <div class="info-title">${displayText}</div>
            <div class="info-category">${category}</div>
          </div>
        `;

        infoWindow.setContent(content);
        infoWindow.setPosition(event.latLng);
        infoWindow.open(map.current);
      });
      // 🔹 Az X gomb eltüntetése (kis késleltetéssel, hogy biztos működjön)
      setTimeout(() => {
        document.querySelector(".gm-ui-hover-effect")?.remove();
      }, 100);

      map.current.data.addListener("mouseout", () => {
        infoWindow.close();
      });
        

        console.log("Térkép sikeresen inicializálva!");
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError(err.message);
      }
    };

    initMap();

    if (window.location.pathname === "/") {
      navigate("/map", { replace: true });
    }
  }, [navigate]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      <SearchPanel />
      {loading && <p>Betöltés...</p>}
      {error && <p style={{ color: "red" }}>Hiba történt: {error}</p>}
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
    </div>
  );
};

export default MapComponent;
