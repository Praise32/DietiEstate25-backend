import axios from "axios";
export async function geocodeAddress(address, city, cap) {
    try {
        const query = `${address}, ${cap} ${city}, Italy`;
        const response = await axios.get("https://nominatim.openstreetmap.org/search", {
            params: {
                q: query,
                format: "json",
                limit: 1,
                countrycodes: "it",
                addressdetails: 1,
            },
            headers: {
                "User-Agent": "DietiDeals24-Backend/1.0",
            },
        });
        if (response.data && response.data.length > 0) {
            const result = response.data[0];
            return {
                latitude: Number.parseFloat(result.lat),
                longitude: Number.parseFloat(result.lon),
                formattedAddress: result.display_name,
            };
        }
        return null;
    }
    catch (error) {
        console.error("Errore durante il geocoding:", error);
        return null;
    }
}
