import React, { useState, useEffect, useRef } from "react";
import "../App.css";
import "../SearchPanel.css";

const SearchPanel = ({ onSearch, onRouteSearch, onGroupSelect,
  onCancelRoute, hudHidden, delHighlight, routeUI, onStepClick, onCloseSteps, routeDisabled = false, isBuildingView,
  currentFloor, selectedGroup, onClearGroup, onToggleHUD, selectedBuilding}) => {
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
  const canRoute = !!startPoint.trim() && !!destination.trim();

  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches
  );
  const [routeStarted, setRouteStarted] = useState(false);

  const [stepsOpen, setStepsOpen] = useState(false);

  const [noResults, setNoResults] = useState(false);
  
  useEffect(() => {
    const fetchSuggestions = async (query) => {
    if (!query.trim()) {
      setSuggestions([]);
      setNoResults(false);
      return;
    }

    setSelectedIndex(-1);
    suggestionRefs.current = [];

    try {
      const resp = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await resp.json();

      const results = [
        ...data.buildings.map((b) => ({ name: b.name, type: "Épület" })),
        ...data.rooms.map((r) => ({ name: r.name, type: "Terem" })),
      ];

      // ha pontos egyezés van, ne mutassunk listát; üres állapot se legyen
      if (results.some(item => item.name.toLowerCase() === query.toLowerCase())) {
        setSuggestions([]);
        setNoResults(false);
      } else {
        setSuggestions(results);
        setNoResults(results.length === 0);
      }
    } catch (e) {
      console.error("Suggesztió hiba:", e);
      setSuggestions([]);
      setNoResults(true);
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
    if (routeDisabled) {
      alert("Csoportnézetben nem tervezhetsz útvonalat. Előbb töröld a csoportszűrőt.");
      return;
    }
    if (!startPoint || !destination) {
      alert("Kérlek add meg mindkét helyet az útvonaltervezéshez!");
      return;
    }
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

useEffect(() => {
  const mq = window.matchMedia("(max-width: 640px)");
  const onChange = () => setIsMobile(mq.matches);
  mq.addEventListener?.("change", onChange);
  // régebbi böngésző fallback
  mq.addListener?.(onChange);
  return () => {
    mq.removeEventListener?.("change", onChange);
    mq.removeListener?.(onChange);
  };
}, []);

const isMobileRouting = isMobile && routeStarted;

  const handleSearch = () => {
    const q = searchQuery.trim();
    if (!q) return;
    onSearch(q);
    setSuggestions([]);
  };

 const handleGroupClick = (group) => {
   // ha épp útvonaltervezésben vagyunk, állítsuk le és csukjuk be a UI-t
   if (routeUI?.steps?.length) {
     setStepsOpen(false);
     setShowRouteInputs(false);
     onCancelRoute?.();
   }

   if (selectedGroup === group) {
    onClearGroup?.();
    return;
  }

   // biztos, ami biztos: töröljük a kiemeléseket
   delHighlight?.();
   // végül mehet a csoportválasztás
   onGroupSelect?.(group);
 };

  const StatusChip = ({ isBuildingView, currentFloor, selectedGroup, onClearGroup }) => {
    const clean = (s) => (s || "").replace(/"/g, "").trim();
    const mode = isBuildingView
    ? `Belső nézet • ${clean(selectedBuilding) || "—"} • Szint: ${currentFloor ?? "-"}`
    : `Külső nézet${selectedGroup ? ` • ${clean(selectedGroup)}` : ""}`;


    const showClear = !isBuildingView && !!selectedGroup;

    return (
      <div className="status-chip">
        <span className="status-dot" aria-hidden="true" />
        <span className="status-text">{mode}</span>
        {showClear && (
          <button className="status-clear" onClick={onClearGroup} title="Kilépés a csoportból">×</button>
        )}
      </div>
    );
  };

  const EmptyState = ({ onPick }) => (
    <div className="empty-state">
      <div className="empty-title">Nincs találat</div>
      <div className="empty-tip">Próbáld például: "UT-101"</div>
    </div>
  );

  return (
    <>
     <div className={`search-shell ${isMobileRouting ? "mobile-routing" : ""}`}>
      <button
        className={`toggle-hud-btn ${hudHidden ? "compact" : ""}`}
        onClick={onToggleHUD}          
        aria-label={hudHidden ? "Oldalsáv megnyitása" : "Oldalsáv elrejtése"}
        title={hudHidden ? "Megnyitás" : "Elrejtés"}
      >
        {hudHidden ? '▶' : '◀'}
      </button>
    <div className={`search-panel ${hudHidden ? 'hidden' : ''}`}>
      <StatusChip
        isBuildingView={isBuildingView}
        currentFloor={currentFloor}
        selectedGroup={selectedGroup}
        onClearGroup={onClearGroup}
        selectedBuilding={selectedBuilding}
      />

      {/* Legutóbbi keresések chipek */}
      {!showRouteInputs ? (
        <div className="search-bar">
          <div className="autocomplete">
              <input
                type="text"
                placeholder="Keresés.. (pl. D302)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setActiveInput("search")}
                onKeyDown={(e) => {
                  if ((e.key === "ArrowDown" || e.key === "ArrowUp") && suggestions.length === 0) return;
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
              {noResults && activeInput === "search" && (
                <EmptyState onPick={(v) => { setSearchQuery(v); setNoResults(false); }} />
              )}
            </div>
            <button className="search-btn" onClick={handleSearch}>
              <img src={searchIcon} alt="Keresés" title="Keresés"/>
            </button>
          <button
            className={`route-btn ${routeDisabled ? 'is-disabled' : ''}`}
            onClick={() => {
              if (routeDisabled) {
                alert("Csoportnézetben nem tervezhetsz útvonalat. Előbb töröld a csoportszűrőt.");
                return;
              }
              setShowRouteInputs(true);
              delHighlight();
            }}
            disabled={routeDisabled}
          >
            <img src={routeIcon} alt="Útvonaltervezés" title="Útvonaltervezés" />
          </button>
        </div>
      ) : (
        <div className="route-inputs">
            <div className="autocomplete">
              <input className="route-input"
                type="text"
                placeholder="Honnan indulsz?"
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
              {noResults && activeInput === "start" && (
                <EmptyState onPick={(v) => { setSearchQuery(v); setNoResults(false); }} />
              )}
            </div>
            <div className="autocomplete">
              <input className="route-input"
                type="text"
                placeholder="Hová mennél?"
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
              {noResults && activeInput === "destination" && (
                <EmptyState onPick={(v) => { setSearchQuery(v); setNoResults(false); }} />
              )}
            </div>
          <button
            className={`route-btn search-route-btn ${!canRoute ? "secondary" : ""}`}
            onClick={() => {
              if (!canRoute) return;
              if (isMobile) setRouteStarted(true);
              onCancelRoute();
              handleRouteSearch();
            }}
            disabled={!canRoute}
            title={!canRoute ? "Add meg a kezdőpontot és az úticélt" : "Útvonaltervezés indítása"}
          >
            Útvonaltervezés
          </button>

          <button
            className="route-btn"
            onClick={() => {
              setStepsOpen(false);
              setShowRouteInputs(false);
              setRouteStarted(false);
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
              {isMobile && routeStarted && (
                <button
                  className="route-back-btn"
                  onClick={() => {
                    setStepsOpen(false);
                    setShowRouteInputs(false);
                    setRouteStarted(false);
                    onCancelRoute?.();
                  }}
                >
                  x
                </button>
              )}
              <div className="route-steps-title">
                <img className="route-steps-icon" src="/assets/icons/pitch.svg" alt="" />
                <div className="route-steps-texts">
                  <div className="route-steps-mainline">
                    Kövesd az alábbi lépéseket!
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
                <div className="route-rail" aria-hidden="true" />
                  {routeUI.steps.map((s, idx) => {
                    const active = s.id === routeUI.activeStepId;
                    const first = idx === 0;
                    const last  = idx === routeUI.steps.length - 1;
                    return (
                      <li
                        key={s.id}
                        className={`route-step ${active ? "active" : ""} ${first ? "first" : ""} ${last ? "last" : ""}`}
                        onClick={() => onStepClick?.(s)}
                        title={s.subtitle || s.title}
                      >
                        <div className={`route-step-bullet ${active ? "active" : ""}`} />
                        <div className="route-step-texts">
                          <div className="route-step-title">
                            {first ? "Kezdőpont: " : last ? "Úticél: " : ""}{s.title}
                          </div>
                          {active && (s.subtitle || s.distanceLabel) && (
                            <div className="route-step-subtitle">
                              {s.subtitle}{s.subtitle && s.distanceLabel ? " • " : ""}{s.distanceLabel}
                            </div>
                          )}
                          {active && s.hint && (
                            <div className="route-step-hint">{s.hint}</div>
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
        {[
          "Kollégiumok",
          "Sportcsarnokok",
          "Parkolók",
          "Tanulmányi épületek",
          "Étel",
          "Mosdók"
        ].map((g) => (
          <button
            key={g}
            className={`category-btn ${selectedGroup === g ? "active" : ""}`}
            onClick={() => handleGroupClick(g)}
            aria-pressed={selectedGroup === g}
          >
            {g}
          </button>
        ))}
      </div>
    </div>
    </div>
    </>
  );
};

export default SearchPanel;
