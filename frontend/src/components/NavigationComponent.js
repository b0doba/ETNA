import { useEffect, useState } from "react";

const NavigationComponent = ({ start, end, map }) => {
  const [directionsService, setDirectionsService] = useState(null);
  const [directionsRenderer, setDirectionsRenderer] = useState(null);

  useEffect(() => {
    if (!window.google || !window.google.maps || !map) return;

    setDirectionsService(new window.google.maps.DirectionsService());
    setDirectionsRenderer(new window.google.maps.DirectionsRenderer({ map }));

  }, [map]);

  useEffect(() => {
    if (!directionsService || !directionsRenderer || !start || !end) return;

    const request = {
      origin: start,
      destination: end,
      travelMode: window.google.maps.TravelMode.WALKING, // Sétaútvonal tervezése
    };

    directionsService.route(request, (result, status) => {
      if (status === window.google.maps.DirectionsStatus.OK) {
        directionsRenderer.setDirections(result);
      } else {
        console.error("Útvonaltervezési hiba:", status);
      }
    });
  }, [start, end, directionsService, directionsRenderer]);

  return null;
};

export default NavigationComponent;