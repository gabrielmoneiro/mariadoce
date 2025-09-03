interface MapboxRouteResponse {
  routes: {
    distance: number; // Distance in meters
    duration: number;
    // Outras propriedades podem ser adicionadas conforme necessário
  }[];
  code: string;
  // Outras propriedades podem ser adicionadas conforme necessário
}

export const getRouteDistance = async (
  originLng: number,
  originLat: number,
  destinationLng: number,
  destinationLat: number,
  apiKey: string,
  profile: string = "mapbox/cycling" // Default to cycling, pode ser 'mapbox/driving' para moto
): Promise<number | null> => {
  const coordinates = `${originLng},${originLat};${destinationLng},${destinationLat}`;
  const url = `https://api.mapbox.com/directions/v5/${profile}/${coordinates}?alternatives=false&geometries=geojson&overview=simplified&steps=false&access_token=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Mapbox API Error:", errorData);
      throw new Error(`Mapbox API request failed with status ${response.status}: ${errorData.message || response.statusText}`);
    }
    const data: MapboxRouteResponse = await response.json();

    if (data.code === "Ok" && data.routes && data.routes.length > 0) {
      return data.routes[0].distance; // Distância em metros
    } else {
      console.error("Mapbox API: No route found or error in response", data);
      return null;
    }
  } catch (error) {
    console.error("Error fetching route from Mapbox:", error);
    return null;
  }
};

