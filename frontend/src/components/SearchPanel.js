import React, { useState, useEffect, useRef } from "react";
import "../App.css";

const SearchPanel = ({ onSearch, onRouteSearch, onGroupSelect, onCancelRoute, hudHidden, delHighlight, routeUI, onStepClick, onCloseSteps  }) => {
  const [showRouteInputs, setShowRouteInputs] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [startPoint, setStartPoint] = useState("");
  const [destination, setDestination] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const suggestionRefs = useRef([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [activeInput, setActiveInput] = useState("search");
  const searchIcon = "/assets/icons/arrow.svg";
  const routeIcon =  "/assets/icons/pitch.svg";

  const [stepsOpen, setStepsOpen] = useState(false);
  
  useEffect(() => {
    const fetchSuggestions = async (query) => {

      
      
      if (!query.trim()) {
        setSuggestions([]);
        return;
      }

      setSelectedIndex(-1);
      suggestionRefs.current = [];

      
      try {
        const response = await fetch(`http://localhost:5000/api/search?q=${query}`);
        const data = await response.json();

        let results = [
          ...data.buildings.map((b) => ({ name: b.name, type: "Épület" })),
          ...data.rooms.map((r) => ({ name: r.name, type: "Terem" }))
        ];

        if (results.some(item => item.name === query)) {
          setSuggestions([]);
        } else {
          setSuggestions(results);
        }
      } catch (error) {
        console.error("Hiba a keresési javaslatok betöltésekor:", error);
      }
    };

    if (activeInput === "search") fetchSuggestions(searchQuery);
    if (activeInput === "start") fetchSuggestions(startPoint);
    if (activeInput === "destination") fetchSuggestions(destination);

  }, [searchQuery, startPoint, destination, activeInput]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      delHighlight();
    }
  }, [searchQuery, delHighlight]);

  
  
  // Keresési funkció az útvonalhoz
  const handleRouteSearch = () => {
    if (!startPoint || !destination) {
      alert("Kérlek add meg mindkét helyet az útvonaltervezéshez!");
      return;
    }
    console.log("Kezdőpont: ",startPoint, "Úticél: ",destination)
    
    onRouteSearch(startPoint, destination, suggestions);
  };
  
  useEffect(() => {
  if (
    selectedIndex >= 0 &&
    suggestionRefs.current[selectedIndex] &&
    suggestionRefs.current[selectedIndex].scrollIntoView
  ) {
    suggestionRefs.current[selectedIndex].scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }
}, [selectedIndex]);

useEffect(() => {
  if (routeUI?.steps?.length) {
    requestAnimationFrame(() => setStepsOpen(true));
  }
}, [routeUI?.steps?.length]);

  const handleSearch = () => {
    onSearch(searchQuery);
    setSuggestions([]);
  };

  return (
    <>
    <div className={`search-panel ${hudHidden ? 'hidden' : ''}`}>
      {!showRouteInputs ? (
        <div className="search-bar">
          <div className="autocomplete">
              <input
                type="text"
                placeholder="Keresés..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setActiveInput("search")}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    setSelectedIndex((prev) => (prev + 1) % suggestions.length);
                  } else if (e.key === "ArrowUp") {
                    setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
                  } else if (e.key === "Enter") {
                    if (selectedIndex >= 0 && suggestions[selectedIndex]) {
                      const selected = suggestions[selectedIndex];
                      setSearchQuery(selected.name);
                      setSuggestions([]);
                      setSelectedIndex(-1);
                    } else {
                      handleSearch();
                    }
                  }
                }}
              />
              {suggestions.length > 0 && activeInput === "search" && (
                <ul className="autocomplete-list">
                  {suggestions.map((item, index) => (
                    <li
                    key={index}
                    ref={(el) => (suggestionRefs.current[index] = el)}
                    className={index === selectedIndex ? "selected" : ""}
                    onClick={() => {
                      setSearchQuery(item.name); // vagy setStartPoint / setDestination
                      setSuggestions([]);
                      setSelectedIndex(-1);
                    }}
                  >
                    {item.name} ({item.type})
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button className="search-btn" onClick={handleSearch}>
              <img src={searchIcon} alt="Keresés" title="Keresés"/>
            </button>
          <button className="route-btn" onClick={() => {setShowRouteInputs(true); delHighlight();}}>
            <img src={routeIcon} alt="Útvonaltervezés" title="Útvonaltervezés" />
          </button>
        </div>
      ) : (
        <div className="route-inputs">
            <div className="autocomplete">
              <input className="route-input"
                type="text"
                placeholder="Kiindulópont"
                value={startPoint}
                onChange={(e) => setStartPoint(e.target.value)}
                onFocus={() => setActiveInput("start")}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    setSelectedIndex((prev) => (prev + 1) % suggestions.length);
                  } else if (e.key === "ArrowUp") {
                    setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
                  } else if (e.key === "Enter") {
                    if (selectedIndex >= 0 && suggestions[selectedIndex]) {
                      setStartPoint(suggestions[selectedIndex].name);
                      setSuggestions([]);
                      setSelectedIndex(-1);
                    } else {
                      handleRouteSearch();
                    }
                  }
                }}
              />
              {suggestions.length > 0 && activeInput === "start" && (
                <ul className="autocomplete-list">
                  {suggestions.map((item, index) => (
                    <li
                      key={index}
                      ref={(el) => (suggestionRefs.current[index] = el)}
                      className={index === selectedIndex ? "selected" : ""}
                      onClick={() => {
                       setStartPoint(item.name);
                       setSuggestions([]);
                       setSelectedIndex(-1);
                     }}
                   >
                     {item.name} ({item.type})
                   </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="autocomplete">
              <input className="route-input"
                type="text"
                placeholder="Úticél"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                onFocus={() => setActiveInput("destination")}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    setSelectedIndex((prev) => (prev + 1) % suggestions.length);
                  } else if (e.key === "ArrowUp") {
                    setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
                  } else if (e.key === "Enter") {
                    if (selectedIndex >= 0 && suggestions[selectedIndex]) {
                      setDestination(suggestions[selectedIndex].name);
                      setSuggestions([]);
                      setSelectedIndex(-1);
                    } else {
                      handleRouteSearch();
                    }
                  }
                }}
              />
              {suggestions.length > 0 && activeInput === "destination" && (
                <ul className="autocomplete-list">
                  {suggestions.map((item, index) => (
                    <li
                      key={index}
                      ref={(el) => (suggestionRefs.current[index] = el)}
                      className={index === selectedIndex ? "selected" : ""}
                      onClick={() => {
                        setDestination(item.name);
                        setSuggestions([]);
                        setSelectedIndex(-1);
                    }}
                  >
                    {item.name} ({item.type})
                  </li>
                  ))}
                </ul>
              )}
            </div>
          <button className="route-btn search-route-btn" onClick={() => {onCancelRoute();handleRouteSearch();}}>
            Útvonaltervezés
          </button>
          <button
            className="route-btn"
            onClick={() => {
              setStepsOpen(false);
              setShowRouteInputs(false);
              onCancelRoute?.();
            }}
          >
            Vissza
          </button>
        </div>
      )}
      <p className="description">Írd le hova szeretnél menni!</p>
      {routeUI && routeUI.steps && routeUI.steps.length > 0 && (
          <div className={`route-steps ${stepsOpen ? "is-entering" : ""}`}>
            <div className="route-steps-header">
              <div className="route-steps-title">
                <img className="route-steps-icon" src="/assets/icons/pitch.svg" alt="" />
                <div className="route-steps-texts">
                  <div className="route-steps-mainline">
                    {routeUI.startLabel} → {routeUI.endLabel}
                  </div>
                  {(routeUI.totalDistance || routeUI.totalTime) && (
                    <div className="route-steps-subline">
                      {routeUI.totalDistance ?? ""}{routeUI.totalTime ? ` • ${routeUI.totalTime}` : ""}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <ul className="route-steps-list">
              {routeUI.steps.map((s) => {
                const active = s.id === routeUI.activeStepId;
                return (
                  <li
                    key={s.id}
                    className={`route-step ${active ? "active" : ""}`}
                     onClick={() => {
                      onStepClick?.(s);
                    }}
                    title={s.subtitle || s.title}
                  >
                    <div className={`route-step-bullet ${active ? "active" : ""}`}></div>
                    <div className="route-step-texts">
                      <div className="route-step-title">{s.title}</div>
                      {active && (s.subtitle || s.distanceLabel) && (
                        <div className="route-step-subtitle">
                          {s.subtitle}{s.subtitle && s.distanceLabel ? " • " : ""}{s.distanceLabel}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
    </div>
    <div className={`category-buttons-wrapper ${hudHidden ? 'hidden' : ''}`}>
      <div className="category-buttons">
        <button className="category-btn" onClick={() => onGroupSelect("Kollégiumok")}>Kollégiumok</button>
        <button className="category-btn" onClick={() => onGroupSelect("Sportcsarnokok")}>Sportcsarnokok</button>
        <button className="category-btn" onClick={() => onGroupSelect("Parkolók")}>Parkolók</button>
        <button className="category-btn" onClick={() => onGroupSelect("Tanulmányi épületek")}>Tanulmányi Épületek</button>
        <button className="category-btn">Rendezvények</button>
      </div>
    </div>
    </>
  );
};

export default SearchPanel;
