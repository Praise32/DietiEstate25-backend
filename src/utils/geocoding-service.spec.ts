import axios from "axios";

import { geocodeAddress } from "./geocoding-service";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("geocoding Service - geocodeAddress", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("dovrebbe restituire le coordinate quando l'API risponde correttamente (Scenario Successo)", async () => {
    // Arrange
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

    // Act
    const result = await geocodeAddress("Via Roma", "Napoli", "80100");

    // Assert
    expect(result).toEqual({
      latitude: 40.8518,
      longitude: 14.2681,
      formattedAddress: "Napoli, Campania, Italia",
    });
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it("dovrebbe restituire null se l'indirizzo non viene trovato (Scenario Errore)", async () => {
    // Arrange
    mockedAxios.get.mockResolvedValue({ data: [] });

    // Act
    const result = await geocodeAddress("Indirizzo Inesistente", "Città Fantasma", "00000");

    // Assert
    expect(result).toBeNull();
  });

  it("dovrebbe gestire gli errori di rete restituendo null (Scenario Eccezione)", async () => {
    // Arrange
    mockedAxios.get.mockRejectedValue(new Error("Network Error"));

    // Silenzia console.error per questo test specifico
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    // Act
    const result = await geocodeAddress("Via Roma", "Napoli", "80100");

    // Assert
    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled(); // Verifica che l'errore sia stato loggato

    // Ripristina console.error
    consoleSpy.mockRestore();
  });
});
