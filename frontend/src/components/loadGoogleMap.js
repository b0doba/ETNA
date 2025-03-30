const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_API_KEY;

const loadGoogleMapsScript = () => {
  return new Promise((resolve, reject) => {
    // Ha az API már betöltődött, ne töltsd be újra
    if (window.google && window.google.maps) {
      console.log("Google Maps API már betöltve.");
      resolve();
      return;
    }

    // Ellenőrizzük, hogy a script már létezik-e
    const existingScript = document.getElementById("google-maps-script");
    if (existingScript) {
      existingScript.addEventListener("load", resolve);
      existingScript.addEventListener("error", () => reject(new Error("Google Maps API betöltési hiba.")));
      return;
    }

    console.log("Google Maps API betöltése...");

    // Globális callback létrehozása
    window.initGoogleMaps = () => {
      console.log("Google Maps API sikeresen betöltődött.");
      resolve();
    };

    // Script létrehozása és hozzáadása a DOM-hoz
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&loading=async&libraries=places,drawing,marker&callback=initGoogleMaps`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Google Maps API betöltési hiba."));
    document.body.appendChild(script);
  });
};

export default loadGoogleMapsScript;
