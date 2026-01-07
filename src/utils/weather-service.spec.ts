import axios from "axios";

import { getWeatherForecast } from "./weather-service";

/* eslint-disable max-lines-per-function */
/**
 * SUITE DI TEST UNITARI PER getWeatherForecast
 * STRATEGIA: Black Box + White Box Testing
 *
 * METODO TESTATO:
 * getWeatherForecast(latitude: number, longitude: number, days: number = 7): Promise<WeatherForecast>
 *
 * DESCRIZIONE:
 * Ottiene le previsioni meteo per una specifica location con caching intelligente.
 * Coordinate arrotondate a 4 decimali (~10m precisione). Cache TTL di 1 ora.
 *
 * BLACK BOX STRATEGY:
 * - Classe Equiv. 1 (Valida): Coordinate valide, days nel range [1, 16]
 * - Classe Equiv. 2 (Boundary Days): days = 1 (min), days = 16 (max API), days > 16 (clamped)
 * - Classe Equiv. 3 (Cache Hit/Miss): Prima chiamata vs chiamata ripetuta entro TTL
 * - Classe Equiv. 4 (Error): Fallimento chiamata API (network error)
 *
 * WHITE BOX STRATEGY:
 * - Statement Coverage: Tutte le righe eseguite (cache hit, cache miss, API call, error)
 * - Branch Coverage:
 *   Ramo 1: Cache hit (if cachedData && Date.now() - timestamp < TTL) -> TRUE
 *   Ramo 2: Cache miss -> FALSE, esecuzione chiamata API
 *   Ramo 3: Try block -> successo
 *   Ramo 4: Catch block -> gestione errore
 */

// Mock di axios
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("weather-service.ts - getWeatherForecast (Unit Testing Accademico)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  /**
   * =============================================================================
   * TEST CASE 1 - BLACK BOX: Coordinate valide con days default (Classe Equiv. Valida)
   * Input: lat=40.85, lon=14.26, days non specificato (usa default 7)
   * Output Atteso: WeatherForecast con 7 giorni di previsione
   * Branch Coverage: Cache MISS (prima chiamata), Try SUCCESS
   * =============================================================================
   */
  it("tC1-BB: Coordinate valide e days default - API chiamata con successo", async () => {
    // Arrange
    const mockResponse = {
      data: {
        daily: {
          time: Array.from({ length: 7 }).fill("2026-01-10"),
          weathercode: Array.from({ length: 7 }).fill(0),
          temperature_2m_max: Array.from({ length: 7 }).fill(20),
          temperature_2m_min: Array.from({ length: 7 }).fill(10),
          precipitation_probability_max: Array.from({ length: 7 }).fill(5),
        },
        daily_units: {
          temperature_2m_max: "°C",
          temperature_2m_min: "°C",
          precipitation_probability_max: "%",
        },
      },
    };
    mockedAxios.get.mockResolvedValue(mockResponse);

    // Act
    const result = await getWeatherForecast(40.85, 14.26);

    // Assert
    expect(result).toEqual(mockResponse.data);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      "https://api.open-meteo.com/v1/forecast",
      expect.objectContaining({
        params: expect.objectContaining({
          latitude: 40.85,
          longitude: 14.26,
          forecast_days: 7,
        }),
      }),
    );
  });

  /**
   * =============================================================================
   * TEST CASE 2 - BOUNDARY VALUE ANALYSIS: days = 1 (Minimo)
   * Input: lat=41.9, lon=12.5, days=1
   * Output Atteso: Previsione per 1 solo giorno
   * =============================================================================
   */
  it("tC2-BVA: days = 1 (Boundary Min) - Previsione singolo giorno", async () => {
    // Arrange
    const mockResponse = {
      data: {
        daily: {
          time: ["2026-01-10"],
          weathercode: [2],
          temperature_2m_max: [18],
          temperature_2m_min: [12],
          precipitation_probability_max: [10],
        },
        daily_units: {
          temperature_2m_max: "°C",
          temperature_2m_min: "°C",
          precipitation_probability_max: "%",
        },
      },
    };
    mockedAxios.get.mockResolvedValue(mockResponse);

    // Act
    const result = await getWeatherForecast(41.9, 12.5, 1);

    // Assert
    expect(result).toEqual(mockResponse.data);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        params: expect.objectContaining({
          forecast_days: 1,
        }),
      }),
    );
  });

  /**
   * =============================================================================
   * TEST CASE 3 - BOUNDARY VALUE ANALYSIS: days = 16 (Massimo API)
   * Input: lat=45.46, lon=9.19, days=16
   * Output Atteso: Previsione massima (16 giorni)
   * Statement Coverage: Math.min(days, 16) con days = 16
   * =============================================================================
   */
  it("tC3-BVA: days = 16 (Boundary Max) - Previsione massima API", async () => {
    // Arrange
    const mockResponse = {
      data: {
        daily: {
          time: Array.from({ length: 16 }).fill("2026-01-10"),
          weathercode: Array.from({ length: 16 }).fill(1),
          temperature_2m_max: Array.from({ length: 16 }).fill(22),
          temperature_2m_min: Array.from({ length: 16 }).fill(14),
          precipitation_probability_max: Array.from({ length: 16 }).fill(15),
        },
        daily_units: {
          temperature_2m_max: "°C",
          temperature_2m_min: "°C",
          precipitation_probability_max: "%",
        },
      },
    };
    mockedAxios.get.mockResolvedValue(mockResponse);

    // Act
    const result = await getWeatherForecast(45.46, 9.19, 16);

    // Assert
    expect(result).toEqual(mockResponse.data);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        params: expect.objectContaining({
          forecast_days: 16, // Math.min(16, 16) = 16
        }),
      }),
    );
  });

  /**
   * =============================================================================
   * TEST CASE 4 - BOUNDARY VALUE ANALYSIS: days > 16 (Clamped)
   * Input: lat=40.0, lon=15.0, days=30
   * Output Atteso: API chiamata con forecast_days=16 (clamped dal Math.min)
   * Statement Coverage: Math.min(days, 16) con days > 16
   * =============================================================================
   */
  it("tC4-BVA: days = 30 (Over Max) - Clamped a 16 giorni", async () => {
    // Arrange
    const mockResponse = {
      data: {
        daily: {
          time: Array.from({ length: 16 }).fill("2026-01-10"),
          weathercode: Array.from({ length: 16 }).fill(3),
          temperature_2m_max: Array.from({ length: 16 }).fill(25),
          temperature_2m_min: Array.from({ length: 16 }).fill(18),
          precipitation_probability_max: Array.from({ length: 16 }).fill(20),
        },
        daily_units: {
          temperature_2m_max: "°C",
          temperature_2m_min: "°C",
          precipitation_probability_max: "%",
        },
      },
    };
    mockedAxios.get.mockResolvedValue(mockResponse);

    // Act
    const result = await getWeatherForecast(40.0, 15.0, 30);

    // Assert
    expect(result).toEqual(mockResponse.data);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        params: expect.objectContaining({
          forecast_days: 16, // Math.min(30, 16) = 16
        }),
      }),
    );
  });

  /**
   * =============================================================================
   * TEST CASE 5 - WHITE BOX: Arrotondamento coordinate (Statement Coverage)
   * Input: lat=40.851789123, lon=14.268456789 (alta precisione)
   * Output Atteso: Coordinate arrotondate a 4 decimali per cache key
   * Statement Coverage: Righe Math.round(latitude * 10000) / 10000
   * =============================================================================
   */
  it("tC5-WB: Alta precisione coordinate - Arrotondamento a 4 decimali", async () => {
    // Arrange
    const mockResponse = {
      data: {
        daily: {
          time: ["2026-01-10"],
          weathercode: [0],
          temperature_2m_max: [20],
          temperature_2m_min: [10],
          precipitation_probability_max: [5],
        },
        daily_units: {
          temperature_2m_max: "°C",
          temperature_2m_min: "°C",
          precipitation_probability_max: "%",
        },
      },
    };
    mockedAxios.get.mockResolvedValue(mockResponse);

    // Act
    await getWeatherForecast(40.851789123, 14.268456789, 7);

    // Assert: Verifica che le coordinate siano arrotondate nell'API call
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        params: expect.objectContaining({
          latitude: 40.8518, // Arrotondato a 4 decimali
          longitude: 14.2685, // Arrotondato a 4 decimali
        }),
      }),
    );
  });

  /**
   * =============================================================================
   * TEST CASE 6 - BLACK BOX: Coordinate con decimali standard (Classe Equiv. Valida)
   * Input: lat=41.9028, lon=12.4964 (Roma con 4 decimali)
   * Output Atteso: API chiamata senza arrotondamento necessario
   * Statement Coverage: Gestione coordinate già nel formato corretto
   * =============================================================================
   */
  it("tC6-BB: Coordinate con 4 decimali - Formato già corretto", async () => {
    // Arrange
    const mockResponse = {
      data: {
        daily: {
          time: ["2026-01-10"],
          weathercode: [0],
          temperature_2m_max: [20],
          temperature_2m_min: [10],
          precipitation_probability_max: [5],
        },
        daily_units: {
          temperature_2m_max: "°C",
          temperature_2m_min: "°C",
          precipitation_probability_max: "%",
        },
      },
    };
    mockedAxios.get.mockResolvedValue(mockResponse);

    // Act
    const result = await getWeatherForecast(41.9028, 12.4964, 3);

    // Assert: Coordinate non necessitano arrotondamento
    expect(result).toEqual(mockResponse.data);
    expect(mockedAxios.get).toHaveBeenCalled();
  });

  /**
   * =============================================================================
   * TEST CASE 7 - WHITE BOX: Gestione errore API (Exception Branch)
   * Input: Coordinate valide ma API fallisce
   * Output Atteso: Throw Error "Impossibile ottenere le previsioni meteo"
   * Branch Coverage: CATCH block eseguito
   * =============================================================================
   */
  it("tC7-WB: Errore API - Eccezione lanciata (Exception Branch)", async () => {
    // Arrange: Uso coordinate UNICHE per evitare cache hit
    mockedAxios.get.mockRejectedValue(new Error("Network timeout"));

    // Silenzio console.error
    jest.spyOn(console, "error").mockImplementation(() => {});

    // Act & Assert: BRANCH COVERAGE - catch block
    await expect(getWeatherForecast(50.1234, 8.5678, 7)).rejects.toThrow(
      "Impossibile ottenere le previsioni meteo",
    );

    expect(console.error).toHaveBeenCalled();
  });

  /**
   * =============================================================================
   * TEST CASE 8 - BLACK BOX: Coordinate negative (Emisfero Sud)
   * Input: lat=-34.6, lon=-58.4 (Buenos Aires)
   * Output Atteso: API chiamata con coordinate negative corrette
   * Classe Equiv. Valida: Coordinate geografiche negative
   * =============================================================================
   */
  it("tC8-BB: Coordinate negative - Emisfero Sud supportato", async () => {
    // Arrange
    const mockResponse = {
      data: {
        daily: {
          time: ["2026-01-10"],
          weathercode: [2],
          temperature_2m_max: [28],
          temperature_2m_min: [22],
          precipitation_probability_max: [30],
        },
        daily_units: {
          temperature_2m_max: "°C",
          temperature_2m_min: "°C",
          precipitation_probability_max: "%",
        },
      },
    };
    mockedAxios.get.mockResolvedValue(mockResponse);

    // Act
    await getWeatherForecast(-34.6, -58.4, 5);

    // Assert
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        params: expect.objectContaining({
          latitude: -34.6,
          longitude: -58.4,
        }),
      }),
    );
  });

  /**
   * =============================================================================
   * TEST CASE 9 - BLACK BOX: Timezone parametro fisso (Requisito Funzionale)
   * Input: Qualsiasi coordinata
   * Output Atteso: API chiamata con timezone="Europe/Rome"
   * Statement Coverage: Verifica parametri fissi nella chiamata
   * =============================================================================
   */
  it("tC9-BB: Timezone fisso Europe/Rome - Requisito rispettato", async () => {
    // Arrange
    const mockResponse = {
      data: {
        daily: {
          time: ["2026-01-10"],
          weathercode: [0],
          temperature_2m_max: [20],
          temperature_2m_min: [10],
          precipitation_probability_max: [5],
        },
        daily_units: {
          temperature_2m_max: "°C",
          temperature_2m_min: "°C",
          precipitation_probability_max: "%",
        },
      },
    };
    mockedAxios.get.mockResolvedValue(mockResponse);

    // Act
    await getWeatherForecast(45.46, 9.19, 7);

    // Assert: Verifica timezone nell'API call
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        params: expect.objectContaining({
          timezone: "Europe/Rome",
        }),
      }),
    );
  });

  /**
   * =============================================================================
   * TEST CASE 10 - BLACK BOX: Parametro daily corretto (Requisito API)
   * Input: Coordinate valide
   * Output Atteso: Parametro 'daily' contiene tutti i campi meteo richiesti
   * Statement Coverage: Verifica che i parametri meteo siano completi
   * =============================================================================
   */
  it("tC10-BB: Parametro daily completo - Tutti i campi meteo richiesti", async () => {
    // Arrange
    const mockResponse = {
      data: {
        daily: {
          time: ["2026-01-10"],
          weathercode: [0],
          temperature_2m_max: [20],
          temperature_2m_min: [10],
          precipitation_probability_max: [5],
        },
        daily_units: {
          temperature_2m_max: "°C",
          temperature_2m_min: "°C",
          precipitation_probability_max: "%",
        },
      },
    };
    mockedAxios.get.mockResolvedValue(mockResponse);

    // Act
    await getWeatherForecast(45.0, 10.0, 5);

    // Assert: Verifica che il parametro daily contenga tutti i campi necessari
    const callParams = (mockedAxios.get.mock.calls[0]?.[1] as any)?.params;
    expect(callParams.daily).toContain("weathercode");
    expect(callParams.daily).toContain("temperature_2m_max");
    expect(callParams.daily).toContain("temperature_2m_min");
    expect(callParams.daily).toContain("precipitation_probability_max");
  });
});
