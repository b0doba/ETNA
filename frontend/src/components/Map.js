import React, { useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SearchPanel from "./SearchPanel.js";

const GOOGLE_MAPS_API_KEY = "AIzaSyBWeYuU1qGCrmqjhMElUU8Vtn1SkKF0kE8";

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
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [isBuildingView, setIsBuildingView] = useState(false);
  const [currentFloor, setCurrentFloor] = useState(null);
  const [buildingFloors, setBuildingFloors] = useState([]);
  const [highlightedRoom, setHighlightedRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const handleGroupSelect = (group) => {
    highlightBuilding(null, group); // A highlightBuilding-et hívjuk a kiválasztott csoportra
  };

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
            const category = feature.getProperty("category"); // Ellenőrizzük a "category" mezőt
            const buildingName = feature.getProperty("building");
            const floorNumber = feature.getProperty("number");
            const featureName = feature.getProperty("name");
            const roomFloor = feature.getProperty("floor");
            let fillColor = "gray"; // Alapértelmezett szín
        
            if (category === "floor") fillColor = "lightgray";

            if (highlightedRoom && category === "room" && featureName?.trim() === highlightedRoom.name.trim()) {
              return { fillColor: "red", strokeColor: "black", strokeWeight: 3, visible: roomFloor === currentFloor };
          }
  
          // Az adott szint világosszürke legyen
          if (category === "floor" && buildingName === selectedBuilding && floorNumber === currentFloor) {
              return { fillColor: "lightgray", strokeColor: "black", strokeWeight: 1, visible: true };
          }
  
          // Az adott szinten lévő összes szoba szürke maradjon
          if (category === "room" && buildingName === selectedBuilding && roomFloor === currentFloor) {
              return { fillColor: "gray", strokeColor: "black", strokeWeight: 1, visible: true };
          }

            return {
              fillColor: fillColor,
              strokeColor: "black",
              strokeWeight: 1,
              visible: isBuildingView
              ? (category === "floor" && buildingName === selectedBuilding && floorNumber === currentFloor) ||
                (category === "room" && buildingName === selectedBuilding && feature.getProperty("floor") === currentFloor)
              : category === "building",
            };
          });
        };

        addGeoJSONToMap(buildings, "building");
        addGeoJSONToMap(rooms,"room");
        addGeoJSONToMap(floors, "floor");

        // MOUSEOVER

        const infoWindow = new window.google.maps.InfoWindow();

        map.current.data.addListener("mouseover", (event) => {
          const category = event.feature.getProperty("category") || "Ismeretlen";
          let displayText = event.feature.getProperty("name") || "Nincs név"; // Alapértelmezett

          // Ha az objektum egy "floor", akkor a "number" értéket használjuk
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
        // Az X gomb eltüntetése (kis késleltetéssel, hogy biztos működjön)
        setTimeout(() => {
          document.querySelector(".gm-ui-hover-effect")?.remove();
        }, 100);

        map.current.data.addListener("mouseout", () => {
          infoWindow.close();
        });

        // Building nézet és kilépés
        
        map.current.data.addListener("click", (event) => {
          const category = event.feature.getProperty("category");
        
          if (category === "building") {
            const buildingName = event.feature.getProperty("name");
            setSelectedBuilding(buildingName);
            setIsBuildingView(true);
        
            // Kiválasztott épület szintjeinek lekérése
            const floorsInBuilding = floors.features
              .filter((floor) => floor.properties.building === buildingName)
              .sort((a, b) => a.properties.number - b.properties.number); // Szintek sorrendbe állítása
        
            setBuildingFloors(floorsInBuilding);
            setCurrentFloor(0); // Alapértelmezett szint mindig 0
          }
        });
        

        map.current.addListener("click", (event) => {
          const feature = map.current.data.getFeatureById(event.featureId);
        
          if (!feature || feature.getProperty("category") !== "building") {
            setSelectedBuilding(null);
            setIsBuildingView(false);
            setCurrentFloor(null);
            setHighlightedRoom(null);
          }
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
  }, [navigate, isBuildingView,currentFloor,selectedBuilding, highlightedRoom]);

  const handleSearch = async (query) => {
    if (!query.trim()) return;
  
    try {
      const response = await fetch(`http://localhost:5000/api/search?q=${query}`);
      const data = await response.json();
  
      console.log("🔍 Keresési eredmények:", data);
  
      if (data.buildings.length > 0) {
        setIsBuildingView(false); // Külső nézetre váltás
        setTimeout(() => highlightBuilding(data.buildings[0]), 100); // Kiemelés kis késleltetéssel
      } else if (data.rooms.length > 0) {
        setIsBuildingView(true); // Belső nézetre váltás
        setTimeout(() => highlightRoom(data.rooms[0]), 100); // Biztosítsd, hogy mindig egy tömböt adunk át
      } else {
        alert("Nincs találat!");
      }
    } catch (error) {
      console.error("Hiba a keresés során:", error);
    }
  };

  
  
  const highlightBuilding = (building = null, group = null) => {
    if (!map.current) return;

    if (building) {
        // Ha konkrét épületet keresünk, fókuszáljunk arra
        const coordinates = JSON.parse(building.coordinates);
        const bounds = new window.google.maps.LatLngBounds();
        coordinates.forEach(([lng, lat]) => bounds.extend(new window.google.maps.LatLng(lat, lng)));
        map.current.fitBounds(bounds);
    }

    map.current.data.setStyle((feature) => {
        const featureCategory = feature.getProperty("category"); // "building", "floor", "room"
        const featureGroup = feature.getProperty("group"); // Kollégiumok, Sportcsarnokok, stb.
        const featureName = feature.getProperty("name");

        if (featureCategory === "building") {
            if (group) {
                // Ha egy kategóriát választunk, emeljük ki az összes ebbe tartozó épületet
                return {
                    fillColor: featureGroup === group ? "red" : "gray",
                    strokeColor: "black",
                    strokeWeight: featureGroup === group ? 2 : 1,
                    visible: true,
                };
            } else if (building) {
                // Ha egy adott épületet keresünk, csak azt emeljük ki
                return {
                    fillColor: featureName === building.name ? "red" : "gray",
                    strokeColor: "black",
                    strokeWeight: featureName === building.name ? 2 : 1,
                    visible: true,
                };
            }
        }
        return { visible: false }; // Csak az épületek látszódjanak
    });
};
  
  const highlightRoom = (room) => {
    if (!map.current) return;
  
    setSelectedBuilding(room.floor.building.name);
    setIsBuildingView(true);
    setCurrentFloor(room.floor.number);
    setHighlightedRoom(room);
  
    console.log("📌 Kiemelt szoba:", room);
  
    // Ellenőrzés: Milyen adatokat kap a térkép?
    map.current.data.forEach((feature) => {
      console.log("🔎 Feature a térképen:", {
        name: feature.getProperty("name"),
        category: feature.getProperty("category"),
        building: feature.getProperty("building"),
        floor: feature.getProperty("floor"),
      });
    });
  
    setTimeout(() => {
      map.current.data.setStyle((feature) => {
        const category = feature.getProperty("category");
        const featureName = feature.getProperty("name");
        const buildingName = feature.getProperty("building");
        const floorNumber = feature.getProperty("number");
        const roomFloor = feature.getProperty("floor");
  
        console.log("🎯 Feature ellenőrzése:", { featureName, category, buildingName, floorNumber, roomFloor });
  
        // A keresett szoba kiemelése pirossal
        if (category === "room" && featureName?.trim() === room.name.trim()) {
          return { fillColor: "red", strokeColor: "black", strokeWeight: 3, visible: true };
        }
  
        // Az adott szint világosszürke
        if (category === "floor" && buildingName === room.floor.building.name && floorNumber === room.floor.number) {
          return { fillColor: "lightgray", strokeColor: "black", strokeWeight: 1, visible: true };
        }
  
        // Az adott szinten lévő összes szoba látható marad szürkében
        if (category === "room" && buildingName === room.floor.building.name && roomFloor === room.floor.number) {
          return { fillColor: "gray", strokeColor: "black", strokeWeight: 1, visible: true };
        }
  
        return { visible: false };
      });
    }, 300); // Kis késleltetés, hogy biztosan alkalmazódjanak az állapotok
  };
  
  
  
  
  

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      <SearchPanel
        onSearch={handleSearch}
        highlightBuilding={highlightBuilding}
        highlightRoom={highlightRoom}
        onGroupSelect={handleGroupSelect}
      />
      {loading && <p>Betöltés...</p>}
      {error && <p style={{ color: "red" }}>Hiba történt: {error}</p>}
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
      
      {isBuildingView && buildingFloors.length > 0 && (
      <div className="slider-container">
        <p className="slider-label">Szint: {currentFloor}</p>
        <input
          type="range"
          min={0}
          max={buildingFloors.length - 2}
          value={currentFloor ?? 0}
          onChange={(e) => setCurrentFloor(Number(e.target.value))}
          className="slider"
          orient="vertical"
        />
      </div>
    )}

    </div>
  );
};

export default MapComponent;
