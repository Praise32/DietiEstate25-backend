import axios from "axios";
const weatherCache = {};
const CACHE_TTL = 3600000;
export const weatherCodeMapping = {
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
export async function getWeatherForecast(latitude, longitude, days = 7) {
    const roundedLat = Math.round(latitude * 10000) / 10000;
    const roundedLon = Math.round(longitude * 10000) / 10000;
    const cacheKey = `${roundedLat},${roundedLon},${days}`;
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
export function formatWeatherData(data) {
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
