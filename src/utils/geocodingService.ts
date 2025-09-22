import axios from "axios";

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress?: string;
}

/**
 * Geocoding usando Nominatim (OpenStreetMap)
 */
export async function geocodeAddress(
  address: string, 
  city: string, 
  cap: string
): Promise<GeocodeResult | null> {
  try {
    const query = `${address}, ${cap} ${city}, Italy`;
    
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: query,
        format: 'json',
        limit: 1,
        countrycodes: 'it', // Limita all'Italia
        addressdetails: 1
      },
      headers: {
        'User-Agent': 'DietiDeals24-Backend/1.0' // Richiesto da Nominatim
      }
    });

    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      return {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        formattedAddress: result.display_name
      };
    }

    return null;
  } catch (error) {
    console.error('Errore durante il geocoding:', error);
    return null;
  }
}

