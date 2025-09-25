import axios from "axios";

// Cache semplice in-memory per le previsioni meteo
const weatherCache: Record<string, { data: WeatherForecast; timestamp: number }> = {};
const CACHE_TTL = 3600000; // 1 ora in millisecondi

/**
 * Interfaccia per i dati meteo restituiti da OpenMeteo
 */
export interface WeatherForecast {
  daily: {
    time: string[];
    weathercode: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
  };
  daily_units: {
    temperature_2m_max: string;
    temperature_2m_min: string;
    precipitation_probability_max: string;
  };
}

/**
 * Mappatura dei codici meteo di OpenMeteo a descrizioni leggibili
 */
export const weatherCodeMapping: Record<number, string> = {
  0: "Sereno",
  1: "Prevalentemente sereno",
  2: "Parzialmente nuvoloso",
  3: "Nuvoloso",
  45: "Nebbia",
  48: "Nebbia con brina",
  51: "Pioggia leggera",
  53: "Pioggia moderata",
  55: "Pioggia intensa",
  61: "Pioggia debole",
  63: "Pioggia moderata",
  65: "Pioggia forte",
  71: "Neve leggera",
  73: "Neve moderata",
  75: "Neve intensa",
  80: "Rovesci di pioggia leggeri",
  81: "Rovesci di pioggia moderati",
  82: "Rovesci di pioggia intensi",
  95: "Temporale",
  96: "Temporale con grandine leggera",
  99: "Temporale con grandine forte",
};

/**
 * Ottiene le previsioni meteo per una specifica location
 * @param latitude Latitudine della posizione
 * @param longitude Longitudine della posizione
 * @param days Numero di giorni di previsione (max 16)
 * @returns Promise con i dati meteo
 */
// Modifica la funzione getWeatherForecast come segue
export async function getWeatherForecast(latitude: number, longitude: number, days: number = 7): Promise<WeatherForecast> {
  // Arrotonda le coordinate a 4 decimali per la cache (sufficiente per precisione di ~10m)
  const roundedLat = Math.round(latitude * 10000) / 10000;
  const roundedLon = Math.round(longitude * 10000) / 10000;
  const cacheKey = `${roundedLat},${roundedLon},${days}`;

  // Controlla se abbiamo dati in cache non scaduti
  const cachedData = weatherCache[cacheKey];
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
    return cachedData.data;
  }

  try {
    const response = await axios.get("https://api.open-meteo.com/v1/forecast", {
      params: {
        latitude: roundedLat,
        longitude: roundedLon,
        daily: "weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
        timezone: "Europe/Rome",
        forecast_days: Math.min(days, 16),
      },
    });

    // Salva in cache
    weatherCache[cacheKey] = {
      data: response.data,
      timestamp: Date.now(),
    };

    return response.data;
  }
  catch (error) {
    console.error("Errore durante il recupero delle previsioni meteo:", error);
    throw new Error("Impossibile ottenere le previsioni meteo");
  }
}

/**
 * Formatta i dati meteo in un formato più facilmente utilizzabile dal frontend
 */
export function formatWeatherData(data: WeatherForecast) {
  const formattedData = data.daily.time.map((date, index) => ({
    date,
    weatherCode: data.daily.weathercode[index],
    weatherDescription: weatherCodeMapping[data.daily.weathercode[index]] || "Sconosciuto",
    maxTemp: data.daily.temperature_2m_max[index],
    minTemp: data.daily.temperature_2m_min[index],
    precipitationProbability: data.daily.precipitation_probability_max[index],
    units: {
      temperature: data.daily_units.temperature_2m_max,
      precipitation: data.daily_units.precipitation_probability_max,
    },
  }));

  return formattedData;
}
