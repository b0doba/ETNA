import React, { useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SearchPanel from "./SearchPanel.js";
import loadGoogleMapsScript from "./loadGoogleMap";
import NavigationComponent from "./NavigationComponent";

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

  const map = useRef(null);
  const mapContainer = useRef(null);
  const buildingsRef = useRef(null);
  const allFloorsRef = useRef(null);
  const roomsRef = useRef(null);

  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [isBuildingView, setIsBuildingView] = useState(false);
  const [currentFloor, setCurrentFloor] = useState(null);
  const [availableFloorNumbers, setAvailableFloorNumbers] = useState([]);
  const [floorGroup, setFloorGroup] = useState(null);

  const [startLocation, setStartLocation] = useState(null);
  const [endLocation, setEndLocation] = useState(null);
  const [nodes, setNodes] = useState([]);

  const [mapZoom, setMapZoom] = useState(18);
  const [mapCenter, setMapCenter] = useState({ lat: 47.693344, lng: 17.627529 });

  const [hudHidden, setHudHidden] = useState(false);
  const [clearRoute, setClearRoute] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedGroup, setSelectedGroup] = useState(null);

  const [searchHighlightedRoom, setSearchHighlightedRoom] = useState(null);
  const [routeHighlightedRooms, setRouteHighlightedRooms] = useState({ start: null, end: null });
  const [searchHighlightedBuilding, setSearchHighlightedBuilding] = useState(null);
  const [routeHighlightedBuildings, setRouteHighlightedBuildings] = useState({ start: null, end: null });

  const toggleHUD = () => setHudHidden(prev => !prev);

  const handleGroupSelect = (group) => {
    if (selectedGroup === group) {
      setSelectedGroup(null);
      setSearchHighlightedRoom(null);
      setSearchHighlightedBuilding(null);
    } else {
      setSelectedGroup(group);
      highlightSearchBuilding(null, group); // kiemelés beállítása
    }
  };

  useEffect(() => {
    const initMap = async () => {
      try {
        await loadGoogleMapsScript();
        const [buildings,rooms, floors] = await Promise.all([
          fetchGeoJSON("http://localhost:5000/api/buildings"),
          fetchGeoJSON("http://localhost:5000/api/rooms"),
          fetchGeoJSON("http://localhost:5000/api/floors")
        ]);

        const nodesResponse = await fetch("http://localhost:5000/api/nodes");

        const getFloorNumberById = (floorId) => {
          const floor = floors.features.find(f => f.properties?.id === floorId);
          return floor?.properties?.number ?? null;
        };
        
        if (!mapContainer.current) {
          throw new Error("A térkép konténer nem található.");
        }

        const bounds = {
          north: mapCenter.lat + 0.2,
          south: mapCenter.lat - 0.2,
          east: mapCenter.lng + 0.5,
          west: mapCenter.lng - 0.5,
        };

        map.current = new window.google.maps.Map(mapContainer.current, {
          streetViewControl: false,
          mapTypeControl: false,
          zoom: mapZoom,
          center:  mapCenter,
          minZoom: 14,
          fullscreenControl: false,
          restriction: {
            latLngBounds: bounds,
            strictBounds: true,},
          styles: [
            {
              featureType: "poi",
              elementType: "labels",
              stylers: [{ visibility: "off" }],
            },
            {
              featureType: "landscape",
              elementType: "labels",
              stylers: [{ visibility: "off" }],
            },
          ],
        });

        /*const addGeoJSONToMap = (geoJson) => {
          map.current.data.addGeoJson(geoJson);
        
          map.current.data.setStyle((feature) => {
            const category = feature.getProperty("category");
            const featureName = feature.getProperty("name");
            const buildingName = feature.getProperty("building");
            const floorNumber = feature.getProperty("number");
            const roomFloor = feature.getProperty("floor");
            const featureGroup = feature.getProperty("group");

            const isSearchHighlighted = searchHighlightedRoom && featureName === searchHighlightedRoom.name.trim();
            const isRouteStart = routeHighlightedRooms.start && featureName === routeHighlightedRooms.start.name.trim();
            const isRouteEnd = routeHighlightedRooms.end && featureName === routeHighlightedRooms.end.name.trim();

            if ((isSearchHighlighted || isRouteStart || isRouteEnd) && roomFloor === currentFloor) {
              return {
                fillColor: isSearchHighlighted ? "blue" : isRouteStart ? "blue" : "blue",
                strokeColor: "black",
                strokeWeight: 3,
                visible: true,
              };
            }
        
            // Kiemelt szoba
            if (searchHighlightedRoom && category === "room" && featureName?.trim() === searchHighlightedRoom.name.trim()) {
              return {
                fillColor: "blue",
                strokeColor: "black",
                strokeWeight: 3,
                visible: roomFloor === currentFloor,
              };
            }
        
            // Belső nézet logika gather alapján (building -> gather)
            if (isBuildingView && (category === "floor" || category === "room")) {
              const relatedBuilding = buildings.features.find(
                (b) => b.properties.name.trim() === buildingName?.trim()
              );
              const buildingGather = relatedBuilding?.properties?.gather?.replace(/"/g, "").trim();
              const currentGather = floorGroup?.replace(/"/g, "").trim();
        
              if (buildingGather === currentGather) {
                if (category === "floor" && floorNumber === currentFloor) {
                  return {
                    fillColor: "lightgray",
                    strokeColor: "black",
                    strokeWeight: 1,
                    visible: true,
                  };
                }
        
                if (category === "room" && roomFloor === currentFloor) {
                  return {
                    fillColor: "gray",
                    strokeColor: "black",
                    strokeWeight: 1,
                    visible: true,
                  };
                }
        
                return { visible: false }; // Nem aktuális szint
              }
            }

            if (!isBuildingView && category === "building") {
              const isSearchHighlighted =
              searchHighlightedBuilding &&
              (
                (searchHighlightedBuilding.name && featureName === searchHighlightedBuilding.name) ||
                (!searchHighlightedBuilding.name && searchHighlightedBuilding.group && featureGroup === searchHighlightedBuilding.group)
              );
              const isRouteStart = routeHighlightedBuildings.start && featureName === routeHighlightedBuildings.start.name;
              const isRouteEnd = routeHighlightedBuildings.end && featureName === routeHighlightedBuildings.end.name;
            
              let fillColor = "gray";
              let strokeWeight = 1;
            
              if (isSearchHighlighted) {
                fillColor = "blue";
                strokeWeight = 2;
              } else if (isRouteStart) {
                fillColor = "blue";
                strokeWeight = 2;
              } else if (isRouteEnd) {
                fillColor = "blue";
                strokeWeight = 2;
              }
            
              return {
                fillColor,
                strokeColor: "black",
                strokeWeight,
                visible: true,
              };
            }
        
            // Minden más rejtve
            return { visible: false };
          });
        };*/

        const addGeoJSONToMap = (geoJson) => {
          map.current.data.addGeoJson(geoJson);
          map.current.data.setStyle(getFeatureStyle);
        };

        addGeoJSONToMap(buildings, "building");
        addGeoJSONToMap(floors, "floor");
        addGeoJSONToMap(rooms,"room");
        const nodesData = await nodesResponse.json();
        setNodes(nodesData);

        buildingsRef.current = buildings;
        allFloorsRef.current = floors;
        roomsRef.current = rooms;

        const infoWindow = new window.google.maps.InfoWindow();

        map.current.data.addListener("mouseover", (event) => {
          let displayText = event.feature.getProperty("name") || "Nincs név"; // Alapértelmezett
          const content = `
            <div class="custom-info-window">
              <div class="info-title">${displayText}</div>
            </div> `
          ;

          infoWindow.setContent(content);
          infoWindow.setPosition(event.latLng);
          infoWindow.open(map.current);
        });
        
        setTimeout(() => {
          document.querySelector(".gm-ui-hover-effect")?.remove();
        }, 100);

        map.current.data.addListener("mouseout", () => {
          infoWindow.close();
        });

        map.current.data.addListener("click", (event) => {
          const category = event.feature.getProperty("category");
        
          if (category === "building") {
            const buildingName = event.feature.getProperty("name");
            const gatherName = event.feature.getProperty("gather");

            if (!gatherName) {
              console.warn("Nincs 'gather' mező ehhez az épülethez:", buildingName);
              return;
            }

            focusOnBuilding(buildingName, gatherName);
          }
        });

        map.current.addListener("click", (event) => {
          setSelectedBuilding(null);
          setIsBuildingView(false);
          setCurrentFloor(null);
          setMapZoom(18);
          setFloorGroup(null);
      });

      nodesData.forEach((node) => {

        const nodeFloorNumber = getFloorNumberById(node.floorId);

        if (
          (isBuildingView && nodeFloorNumber !== currentFloor) ||
          (!isBuildingView && node.floorId !== null)
        ) {
          return;
        }

        if (node.coordinates && node.iconUrl) {
          const [lng, lat] = JSON.parse(node.coordinates)[0];
      
          const iconDiv = document.createElement("div");
          iconDiv.style.position = "absolute";
          
          const img = document.createElement("img");
          img.src = `/assets/icons/${node.iconUrl}`; 
          img.style.width = "30px";
          img.style.height = "30px";
          iconDiv.appendChild(img);
      
          const overlay = new window.google.maps.OverlayView();
          let currentZoom = map.current.getZoom();

          overlay.onAdd = function () {
            const panes = this.getPanes();
            panes.overlayImage.appendChild(iconDiv);

            map.current.addListener("zoom_changed", () => {
              currentZoom = map.current.getZoom();
              overlay.draw(); 
            });
          };
          overlay.draw = function () {
            const projection = this.getProjection();
            const position = projection.fromLatLngToDivPixel(new window.google.maps.LatLng(lat, lng));
          
            if (currentZoom >= 17) {
              iconDiv.style.display = "block";
          
              // 🔧 Méret zoom szerint
              const baseSize = 40;
              const maxZoom = 21;
              const minZoom = 17;
              const clampedZoom = Math.min(Math.max(currentZoom, minZoom), maxZoom);
          
              // Lineáris skálázás (közeli zoomnál kisebb, távolinál nagyobb)
              const scaleFactor = 1 + ((maxZoom - clampedZoom) * 0.3); // pl. zoom 17 → x2.2, zoom 21 → x1
              const size = baseSize / scaleFactor;
          
              img.style.width = `${size}px`;
              img.style.height = `${size}px`;

              let opacity = 1;
              if (currentZoom <= 16) {
                opacity = 0;
              } else if (currentZoom >= 21) {
                opacity = 1;
              } else {
                opacity = (currentZoom - 18) / (21 - 18); // Lineáris skála
              }

              iconDiv.style.opacity = opacity.toFixed(2);
          
              iconDiv.style.left = `${position.x}px`;
              iconDiv.style.top = `${position.y}px`;
              iconDiv.style.transform = "translate(-50%, -50%)"; // középre igazítás
            } else {
              iconDiv.style.display = "none";
            }
          };
          overlay.onRemove = function () {
            if (iconDiv.parentNode) {
              iconDiv.parentNode.removeChild(iconDiv);
            }
          };
      
          overlay.setMap(map.current);
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

  }, [navigate, isBuildingView, currentFloor, selectedBuilding, searchHighlightedRoom, mapZoom, mapCenter, floorGroup]);

  useEffect(() => {
    if (!map.current) return;
    map.current.data.setStyle(getFeatureStyle);
  }, [searchHighlightedBuilding,
      routeHighlightedBuildings,
      searchHighlightedRoom,
      routeHighlightedRooms,
      isBuildingView,
      currentFloor,
      floorGroup,
      selectedGroup,
  ]);

  const getFeatureStyle = (feature) => {
    const category = feature.getProperty("category");
    const featureName = feature.getProperty("name");
    const buildingName = feature.getProperty("building");
    const floorNumber = feature.getProperty("number");
    const roomFloor = feature.getProperty("floor");
    const featureGroup = feature.getProperty("group");
  
    const isSearchHighlighted = searchHighlightedRoom && featureName === searchHighlightedRoom.name.trim();
    const isRouteStart = routeHighlightedRooms.start && featureName === routeHighlightedRooms.start.name.trim();
    const isRouteEnd = routeHighlightedRooms.end && featureName === routeHighlightedRooms.end.name.trim();
  
    if ((isSearchHighlighted || isRouteStart || isRouteEnd) && roomFloor === currentFloor) {
      return {
        fillColor: "blue",
        strokeColor: "black",
        strokeWeight: 3,
        visible: true,
      };
    }
  
    if (isBuildingView && (category === "floor" || category === "room")) {
      const relatedBuilding = buildingsRef.current?.features?.find(
        (b) => b.properties.name.trim() === buildingName?.trim()
      );
      const buildingGather = relatedBuilding?.properties?.gather?.replace(/"/g, "").trim();
      const currentGather = floorGroup?.replace(/"/g, "").trim();
  
      if (buildingGather !== currentGather) return { visible: false };
  
      if (category === "floor" && floorNumber === currentFloor) {
        return {
          fillColor: "lightgray",
          strokeColor: "black",
          strokeWeight: 1,
          visible: true,
        };
      }
  
      if (category === "room" && roomFloor === currentFloor) {
        return {
          fillColor: "gray",
          strokeColor: "black",
          strokeWeight: 1,
          visible: true,
        };
      }
  
      return { visible: false };
    }
  
    if (!isBuildingView && category === "building") {
      const clean = str => (str || "").replace(/"/g, "").trim();
      const isSearchHighlighted =
        searchHighlightedBuilding &&
        (
          (searchHighlightedBuilding.name && clean(featureName) === clean(searchHighlightedBuilding.name)) ||
          (!searchHighlightedBuilding.name && searchHighlightedBuilding.group && clean(featureGroup) === clean(searchHighlightedBuilding.group))
        );
  
      const isRouteStart = routeHighlightedBuildings.start && featureName === routeHighlightedBuildings.start.name;
      const isRouteEnd = routeHighlightedBuildings.end && featureName === routeHighlightedBuildings.end.name;
      const isGroupHighlighted = selectedGroup && clean(featureGroup) === clean(selectedGroup);
  
      let fillColor = "gray";
      let strokeWeight = 1;
  
      if (isSearchHighlighted || isGroupHighlighted) {
        fillColor = "blue";
        strokeWeight = 3;
      } else if (isRouteStart || isRouteEnd) {
        fillColor = "blue";
        strokeWeight = 3;
      }
  
      return {
        fillColor,
        strokeColor: "black",
        strokeWeight,
        visible: true,
      };
    }
  
    return { visible: false };
  };

  /*useEffect(() => {
    if (!map.current) return;

    map.current.data.setStyle(null);
    
    map.current.data.setStyle((feature) => {
      const category = feature.getProperty("category");
      const featureName = feature.getProperty("name");
      const buildingName = feature.getProperty("building");
      const floorNumber = feature.getProperty("number");
      const roomFloor = feature.getProperty("floor");
      const featureGroup = feature.getProperty("group");

      const isSearchHighlighted = searchHighlightedRoom && featureName === searchHighlightedRoom.name.trim();
      const isRouteStart = routeHighlightedRooms.start && featureName === routeHighlightedRooms.start.name.trim();
      const isRouteEnd = routeHighlightedRooms.end && featureName === routeHighlightedRooms.end.name.trim();

      if ((isSearchHighlighted || isRouteStart || isRouteEnd) && roomFloor === currentFloor) {
        return {
          fillColor: "blue",
          strokeColor: "black",
          strokeWeight: 3,
          visible: true,
        };
      }

      if (isBuildingView && (category === "floor" || category === "room")) {
        const relatedBuilding = buildingsRef.current?.features?.find(
          b => b.properties.name.trim() === buildingName?.trim()
        );
        const buildingGather = relatedBuilding?.properties?.gather?.replace(/"/g, "").trim();
        const currentGather = floorGroup?.replace(/"/g, "").trim();
    
        if (buildingGather !== currentGather) {
          return { visible: false };
        }
    
        if (category === "floor" && floorNumber === currentFloor) {
          return {
            visible: true,
            fillColor: "lightgray",
            strokeColor: "black",
            strokeWeight: 1,
          };
        }
    
        if (category === "room" && roomFloor === currentFloor) {
          return {
            visible: true,
            fillColor: "gray",
            strokeColor: "black",
            strokeWeight: 1,
          };
        }
    
        return { visible: false };
      }
      
      if (!isBuildingView && category === "building") {
        const clean = str => (str || "").replace(/"/g, "").trim();

        const isSearchHighlighted =
          searchHighlightedBuilding &&
          (
            (searchHighlightedBuilding.name && clean(featureName) === clean(searchHighlightedBuilding.name)) ||
            (!searchHighlightedBuilding.name && searchHighlightedBuilding.group && clean(featureGroup) === clean(searchHighlightedBuilding.group))
          );
  
        const isRouteStart =
          routeHighlightedBuildings.start && featureName === routeHighlightedBuildings.start.name;
        const isRouteEnd =
          routeHighlightedBuildings.end && featureName === routeHighlightedBuildings.end.name;

        const isGroupHighlighted = selectedGroup && clean(featureGroup) === clean(selectedGroup);

        let fillColor = "gray";
        let strokeWeight = 1;
  
        if (isSearchHighlighted || isGroupHighlighted) {
          fillColor = "blue";
          strokeWeight = 3;
        } else if (isRouteStart || isRouteEnd) {
          fillColor = "blue";
          strokeWeight = 3;
        }
  
        return {
          fillColor,
          strokeColor: "black",
          strokeWeight,
          visible: true,
        };
      }
        return { visible: false };
    });

  }, [searchHighlightedBuilding,
    routeHighlightedBuildings,
    searchHighlightedRoom,
    routeHighlightedRooms,
    isBuildingView,
    currentFloor,
    floorGroup, selectedGroup]);*/
  
  const handleSearch = async (query) => {
    if (!query.trim()) return;
  
    try {
      const response = await fetch(`http://localhost:5000/api/search?q=${query}`);
      const data = await response.json();
  
      console.log("Keresési eredmények:", data);
  
      if (data.buildings.length > 0) {
        setIsBuildingView(false); // Külső nézetre váltás
        setSearchHighlightedRoom(null);

        setTimeout(() => {
          setSearchHighlightedRoom(null);
          highlightSearchBuilding(data.buildings[0]);
        }, 200); // Kiemelés kis késleltetéssel

      } else if (data.rooms.length > 0) {
        const room = data.rooms[0];
            setIsBuildingView(true);
            highlightSearchRoom(room);
      } else {
        alert("Nincs találat!");
      }
    } catch (error) {
      console.error("Hiba a keresés során:", error);
    }
  };

  const highlightSearchBuilding = (building = null, group = null) => {
    if (!map.current) return;
  
    if (building) {
      setSearchHighlightedBuilding(building);
      setRouteHighlightedBuildings({ start: null, end: null });
  
      const coordinates = JSON.parse(building.coordinates);
      const bounds = new window.google.maps.LatLngBounds();
      coordinates.forEach(([lng, lat]) =>
        bounds.extend(new window.google.maps.LatLng(lat, lng))
      );
      map.current.fitBounds(bounds, 120);
    }
  
    else if (group) {
      setSearchHighlightedBuilding(null); // egyéni épület ne zavarjon bele
      setRouteHighlightedBuildings({ start: null, end: null });
  
      let latSum = 0, lngSum = 0, count = 0;
      const bounds = new window.google.maps.LatLngBounds();
  
      map.current.data.forEach((feature) => {
        const featureCategory = feature.getProperty("category");
        const featureGroup = feature.getProperty("group");
  
        if (featureCategory === "building" && featureGroup === group) {
          const geometry = feature.getGeometry();
          if (geometry && geometry.getType() === "Polygon") {
            const firstPath = geometry.getAt(0);
            if (firstPath && firstPath.getAt) {
              const firstCoordinate = firstPath.getAt(0);
              if (firstCoordinate) {
                latSum += firstCoordinate.lat();
                lngSum += firstCoordinate.lng();
                count++;
                bounds.extend(firstCoordinate);
              }
            }
          }
        }
      });
  
      if (count > 0) {
        const center = { lat: latSum / count, lng: lngSum / count };
        map.current.panTo(center);
        map.current.fitBounds(bounds, 280);
      }
  
      setSearchHighlightedBuilding({ name: null, group });
    }
  };
  
  const highlightRouteBuilding = (building, isStart = false) => {
    if (!map.current || !building) return;
  
    setRouteHighlightedBuildings(prev => ({
      ...prev,
      [isStart ? "start" : "end"]: building,
    }));
  
    const coordinates = JSON.parse(building.coordinates);
    const bounds = new window.google.maps.LatLngBounds();
    coordinates.forEach(([lng, lat]) =>
      bounds.extend(new window.google.maps.LatLng(lat, lng))
    );
    map.current.fitBounds(bounds, 120);
  };

    const focusOnBuilding = (buildingName, gatherName) => {
      if (!buildingName || !gatherName) return;
    
      const floors = allFloorsRef.current?.features || [];
      const buildings = buildingsRef.current?.features || [];
    
      setIsBuildingView(true);
      setSelectedBuilding(buildingName);
      setFloorGroup(gatherName);
    
      const floorsInGroup = floors
        .filter((floor) => {
          const relatedBuilding = buildings.find(
            (b) => b.properties.name.trim() === floor.properties.building.trim()
          );
          const cleanGather = (str) => str?.replace(/"/g, "").trim();
          const buildingGather = cleanGather(relatedBuilding?.properties?.gather);
          return buildingGather === cleanGather(gatherName);
        })
        .sort((a, b) => a.properties.number - b.properties.number);
    
      const uniqueFloorNumbers = [...new Set(floorsInGroup.map(f => f.properties.number))].sort((a, b) => a - b);
      setAvailableFloorNumbers(uniqueFloorNumbers);
      setCurrentFloor(uniqueFloorNumbers[0] ?? 0);
    
      const buildingFeature = buildings.find((b) => b.properties.name === buildingName);
      if (!buildingFeature) return;
    
      try {
        let coordinates = buildingFeature.geometry.coordinates;
    
        if (buildingFeature.geometry.type === "Polygon") {
          coordinates = coordinates[0];
        } else if (buildingFeature.geometry.type === "MultiPolygon") {
          coordinates = coordinates[0][0];
        }
    
        const bounds = new window.google.maps.LatLngBounds();
        coordinates.forEach(([lng, lat]) => {
          if (isFinite(lat) && isFinite(lng)) {
            bounds.extend(new window.google.maps.LatLng(lat, lng));
          }
        });
    
        const center = bounds.getCenter();
        if (center && isFinite(center.lat()) && isFinite(center.lng())) {
          setMapCenter({ lat: center.lat(), lng: center.lng() });
          setMapZoom(19);
        } else {
          console.warn("Hibás középpont számítás:", center);
        }
      } catch (error) {
        console.error("Hiba az épület fókuszálásakor:", error);
      }
    };    
  
  const highlightSearchRoom = async (room) => {
    if (!map.current || !room) return;

    const buildingName = room.floor.building.name;
    const buildingGather = buildingsRef.current?.features?.find(
      b => b.properties.name.trim() === buildingName.trim()
    )?.properties?.gather?.replace(/"/g, "").trim();

    if (!buildingGather) {
      console.warn("Nincs 'gather' mező a szoba épületéhez:", buildingName);
      return;
    }

    // Állítsuk be a belső nézetet és a kapcsolódó adatokat
    setIsBuildingView(true);
    setSelectedBuilding(buildingName);
    setFloorGroup(buildingGather);
    setCurrentFloor(room.floor.number);
    setSearchHighlightedRoom(room);
    setMapZoom(19);

    // Visszakeressük az összes emeletet, ami a gather csoporthoz tartozik
    const floorsInGroup = allFloorsRef.current?.features
      ?.filter(floor => {
        const relatedBuilding = buildingsRef.current?.features?.find(b => b.properties.name.trim() === floor.properties.building.trim());
        const gather = relatedBuilding?.properties?.gather?.replace(/"/g, "").trim();
        return gather === buildingGather;
      })
      ?.sort((a, b) => a.properties.number - b.properties.number);

    const uniqueFloors = [...new Set(floorsInGroup?.map(f => f.properties.number))];
    setAvailableFloorNumbers(uniqueFloors);

    // Középpont beállítása
    const coordinates = JSON.parse(room.coordinates);
    const bounds = new window.google.maps.LatLngBounds();
    coordinates.forEach(([lng, lat]) => bounds.extend(new window.google.maps.LatLng(lat, lng)));
    setTimeout(() => {
      map.current.fitBounds(bounds, 100);
    }, 300);
  };

  const highlightRouteRoom = async (room, isStart = false) => {
    if (!map.current || !room) return;
    
    const buildingName = room.floor.building.name;
    const buildingGather = buildingsRef.current?.features?.find(
      b => b.properties.name.trim() === buildingName.trim()
    )?.properties?.gather?.replace(/"/g, "").trim();

    if (!buildingGather) {
      console.warn("Nincs 'gather' mező a szoba épületéhez:", buildingName);
      return;
    }

    // Állítsuk be a belső nézetet és a kapcsolódó adatokat
    setIsBuildingView(true);
    setSelectedBuilding(buildingName);
    setFloorGroup(buildingGather);
    setCurrentFloor(room.floor.number);
    setRouteHighlightedRooms(prev => ({
      ...prev,
      [isStart ? "start" : "end"]: room,
    }));
    setMapZoom(19);

    // Visszakeressük az összes emeletet, ami a gather csoporthoz tartozik
    const floorsInGroup = allFloorsRef.current?.features
      ?.filter(floor => {
        const relatedBuilding = buildingsRef.current?.features?.find(b => b.properties.name.trim() === floor.properties.building.trim());
        const gather = relatedBuilding?.properties?.gather?.replace(/"/g, "").trim();
        return gather === buildingGather;
      })
      ?.sort((a, b) => a.properties.number - b.properties.number);

    const uniqueFloors = [...new Set(floorsInGroup?.map(f => f.properties.number))];
    setAvailableFloorNumbers(uniqueFloors);

    // Középpont beállítása
    const coordinates = JSON.parse(room.coordinates);
    const bounds = new window.google.maps.LatLngBounds();
    coordinates.forEach(([lng, lat]) => bounds.extend(new window.google.maps.LatLng(lat, lng)));
    setTimeout(() => {
      map.current.fitBounds(bounds, 100);
    }, 300);
  };

  const handleRouteSearch = async (startName, endName) => { //működik
    try {
      const [startRes, endRes] = await Promise.all([
        fetch(`http://localhost:5000/api/search?q=${startName}`),
        fetch(`http://localhost:5000/api/search?q=${endName}`)
      ]);
  
      const dataStart = await startRes.json();
      const dataEnd = await endRes.json();

      let startNode = dataStart.nodes?.[0] ??
      (dataStart.buildings?.[0] &&
        nodes.find(n => n.buildingId === dataStart.buildings[0].id));

      let endNode = dataEnd.nodes?.[0] ??
        (dataEnd.buildings?.[0] &&
          nodes.find(n => n.buildingId === dataEnd.buildings[0].id));
  
      if (!startNode || !endNode) {
        alert("Nem található megfelelő kezdő vagy célpont.");
        return;
      }
      
      if (dataStart.buildings?.[0]) {
        highlightRouteBuilding(dataStart.buildings[0], true);
      } else if (dataStart.rooms?.[0]) {
        await highlightRouteRoom(dataStart.rooms[0], true);
      }
      
      if (dataEnd.buildings?.[0]) {
        highlightRouteBuilding(dataEnd.buildings[0], false);
      } else if (dataEnd.rooms?.[0]) {
        await highlightRouteRoom(dataEnd.rooms[0], false);
      }
  
      // Állítsuk be a NavigationComponent-hez szükséges értékeket
      setStartLocation({ id: startNode.id, coordinates: startNode.coordinates });
      setEndLocation({ id: endNode.id, coordinates: endNode.coordinates });
      setClearRoute(false);
  
    } catch (err) {
      console.error("Hiba az útvonalhoz szükséges node-ok lekérésénél:", err);
      alert("Nem sikerült betölteni az útvonalat.");
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
    <button className="toggle-hud-btn" onClick={toggleHUD}>
      {hudHidden ? '▶' : '◀'}
    </button>
    <SearchPanel
      hudHidden={hudHidden}
      onSearch={handleSearch}
      onRouteSearch={handleRouteSearch}
      onGroupSelect={handleGroupSelect}
      onCancelRoute={() => {
        setStartLocation(null);
        setEndLocation(null);
        setClearRoute(true);
        setRouteHighlightedRooms({ start: null, end: null });
        setRouteHighlightedBuildings({ start: null, end: null });
      }}
      delHighlight={() => {
        setSearchHighlightedRoom(null);
        setSearchHighlightedBuilding(null);
      }}
      />
      <NavigationComponent
        start={startLocation}
        end={endLocation}
        map={map.current}
        clear={clearRoute}
        currentFloor={currentFloor}
        isBuildingView={isBuildingView}
        floors={allFloorsRef.current?.features}
      />
      {loading && <p>Betöltés...</p>}
      {error && <p style={{ color: "blue" }}>Hiba történt: {error}</p>}
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
      
      {isBuildingView && availableFloorNumbers.length > 0 && (
        <div className="slider-container">
          <p className="slider-label">Szint: {currentFloor}</p>
          <input
            type="range"
            min={0}
            max={availableFloorNumbers.length - 1}
            value={availableFloorNumbers.indexOf(currentFloor)}
            onChange={(e) => setCurrentFloor(availableFloorNumbers[Number(e.target.value)])}
            className="slider"
            orient="vertical"
          />
        </div>
      )}
    </div>
  );
};

export default MapComponent;