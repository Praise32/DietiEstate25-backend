import axios from "axios";
import { geocodeAddress } from "./geocoding-service.js";
jest.mock("axios");
const mockedAxios = axios;
describe("geocoding Service - geocodeAddress", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });
    it("dovrebbe restituire le coordinate quando l'API risponde correttamente (Scenario Successo)", async () => {
        const mockResponse = {
            data: [
                {
                    lat: "40.8518",
                    lon: "14.2681",
                    display_name: "Napoli, Campania, Italia",
                },
            ],
        };
        mockedAxios.get.mockResolvedValue(mockResponse);
        const result = await geocodeAddress("Via Roma", "Napoli", "80100");
        expect(result).toEqual({
            latitude: 40.8518,
            longitude: 14.2681,
            formattedAddress: "Napoli, Campania, Italia",
        });
        expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });
    it("dovrebbe restituire null se l'indirizzo non viene trovato (Scenario Errore)", async () => {
        mockedAxios.get.mockResolvedValue({ data: [] });
        const result = await geocodeAddress("Indirizzo Inesistente", "Città Fantasma", "00000");
        expect(result).toBeNull();
    });
    it("dovrebbe gestire gli errori di rete restituendo null (Scenario Eccezione)", async () => {
        mockedAxios.get.mockRejectedValue(new Error("Network Error"));
        const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => { });
        const result = await geocodeAddress("Via Roma", "Napoli", "80100");
        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });
});
