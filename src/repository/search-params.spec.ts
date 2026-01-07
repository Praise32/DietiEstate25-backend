import { calculateOffset, createSearchCenterPoint } from "./search-params";

/**
 * SUITE DI TEST UNITARI PER METODI NON BANALI CON STRATEGIA BLACK BOX E WHITE BOX
 * Progetto: DietiEstates25 - Repository Search Parameters
 * Tecniche Applicate:
 * - Equivalence Class Partitioning (Classi di Equivalenza)
 * - Boundary Value Analysis (Analisi Valori Limite)
 * - Statement Coverage (Copertura Istruzioni)
 * - Branch Coverage (Copertura Rami)
 */

describe("search-params Module - Unit Testing Accademico", () => {
  /**
   * =============================================================================
   * METODO 1: createSearchCenterPoint(longitude: number, latitude: number)
   * =============================================================================
   * DESCRIZIONE: Costruisce una stringa WKT (Well-Known Text) per PostGIS con
   *              sistema di riferimento WGS84 (SRID 4326).
   *
   * BLACK BOX STRATEGY:
   * - Classe Equivalenza 1 (Valida): Coordinate geografiche valide (-180 ≤ lon ≤ 180, -90 ≤ lat ≤ 90)
   * - Classe Equivalenza 2 (Limite): Valori ai limiti geografici (±180, ±90)
   * - Classe Equivalenza 3 (Edge Case): Coordinate decimali con alta precisione
   * - Classe Equivalenza 4 (Zero/Origine): Coordinate (0,0) - Punto Null Island
   *
   * WHITE BOX STRATEGY:
   * - Statement Coverage: Ogni riga del metodo viene eseguita almeno una volta
   * - Branch Coverage: Non ci sono rami condizionali (logica lineare)
   * =============================================================================
   */
  describe("createSearchCenterPoint", () => {
    it("tC1-BB: Coordinate italiane valide (Classe Equiv. Valida) - Napoli Centro", () => {
      // Arrange: Coordinate reali di Napoli (Piazza del Plebiscito)
      const longitude = 14.2681;
      const latitude = 40.8359;

      // Act
      const result = createSearchCenterPoint(longitude, latitude);

      // Assert
      expect(result).toBe("SRID=4326;POINT(14.2681 40.8359)");
      expect(result).toContain("SRID=4326");
      expect(result).toContain("POINT(");
      expect(result).toMatch(/POINT\(\d+\.\d+ \d+\.\d+\)/);
    });

    it("tC2-BVA: Valori Limite - Longitudine Massima Est (Boundary Value +180)", () => {
      // Arrange: Limite Est della Terra (Antimeridiano)
      const longitude = 180;
      const latitude = 0;

      // Act
      const result = createSearchCenterPoint(longitude, latitude);

      // Assert
      expect(result).toBe("SRID=4326;POINT(180 0)");
    });

    it("tC3-BVA: Valori Limite - Longitudine Massima Ovest (Boundary Value -180)", () => {
      // Arrange: Limite Ovest della Terra (Antimeridiano)
      const longitude = -180;
      const latitude = 0;

      // Act
      const result = createSearchCenterPoint(longitude, latitude);

      // Assert
      expect(result).toBe("SRID=4326;POINT(-180 0)");
    });

    it("tC4-BVA: Valori Limite - Latitudine Polo Nord (Boundary Value +90)", () => {
      // Arrange: Polo Nord geografico
      const longitude = 0;
      const latitude = 90;

      // Act
      const result = createSearchCenterPoint(longitude, latitude);

      // Assert
      expect(result).toBe("SRID=4326;POINT(0 90)");
    });

    it("tC5-BVA: Valori Limite - Latitudine Polo Sud (Boundary Value -90)", () => {
      // Arrange: Polo Sud geografico
      const longitude = 0;
      const latitude = -90;

      // Act
      const result = createSearchCenterPoint(longitude, latitude);

      // Assert
      expect(result).toBe("SRID=4326;POINT(0 -90)");
    });

    it("tC6-BB: Coordinate origine (0, 0) - Null Island (Edge Case Speciale)", () => {
      // Arrange: Punto di intersezione tra Equatore e Meridiano di Greenwich
      const longitude = 0;
      const latitude = 0;

      // Act
      const result = createSearchCenterPoint(longitude, latitude);

      // Assert
      expect(result).toBe("SRID=4326;POINT(0 0)");
    });

    it("tC7-BB: Coordinate negative (Emisfero Sud-Ovest) - Classe Equiv. Valida", () => {
      // Arrange: Buenos Aires, Argentina
      const longitude = -58.3816;
      const latitude = -34.6037;

      // Act
      const result = createSearchCenterPoint(longitude, latitude);

      // Assert
      expect(result).toBe("SRID=4326;POINT(-58.3816 -34.6037)");
    });

    it("tC8-WB: Alta precisione decimale (Statement Coverage completo)", () => {
      // Arrange: Coordinate con 10 cifre decimali (precisione millimetrica)
      const longitude = 14.2681234567;
      const latitude = 40.8359876543;

      // Act
      const result = createSearchCenterPoint(longitude, latitude);

      // Assert
      expect(result).toBe("SRID=4326;POINT(14.2681234567 40.8359876543)");
      // Verifica che i decimali NON vengano troncati dal metodo
      expect(result).toContain("14.2681234567");
      expect(result).toContain("40.8359876543");
    });

    it("tC9-WB: Valori interi senza decimali (Statement Coverage)", () => {
      // Arrange: Coordinate senza parte decimale
      const longitude = 15;
      const latitude = 45;

      // Act
      const result = createSearchCenterPoint(longitude, latitude);

      // Assert
      expect(result).toBe("SRID=4326;POINT(15 45)");
    });

    it("tC10-BB: Formato SRID corretto per PostGIS (Requisito Funzionale)", () => {
      // Arrange: Qualsiasi coordinata valida
      const longitude = 12.4964;
      const latitude = 41.9028; // Roma

      // Act
      const result = createSearchCenterPoint(longitude, latitude);

      // Assert: Verifica formato WKT conforme a standard PostGIS
      expect(result).toMatch(/^SRID=4326;POINT\(-?\d+(?:\.\d*)? -?\d+(?:\.\d*)?\)$/);
      expect(result.split(";")).toHaveLength(2);
      expect(result.split(";")[0]).toBe("SRID=4326");
    });
  });

  /**
   * =============================================================================
   * METODO 2: calculateOffset(page: number, limit: number)
   * =============================================================================
   * DESCRIZIONE: Calcola l'offset per query SQL paginate usando formula: (page-1)*limit
   *
   * BLACK BOX STRATEGY:
   * - Classe Equivalenza 1 (Valida Positiva): page ≥ 1, limit > 0
   * - Classe Equivalenza 2 (Limite Inferiore): page = 1 (prima pagina, offset = 0)
   * - Classe Equivalenza 3 (Grandi Numeri): Paginazione profonda (es. page = 1000)
   * - Classe Equivalenza 4 (Limite Singolo): limit = 1 (una risorsa per pagina)
   *
   * WHITE BOX STRATEGY:
   * - Statement Coverage: L'unica espressione aritmetica deve essere eseguita
   * - Branch Coverage: Non ci sono rami condizionali (formula matematica pura)
   * =============================================================================
   */
  describe("calculateOffset", () => {
    it("tC1-BVA: Prima pagina (Boundary Value page=1) - Offset deve essere 0", () => {
      // Arrange: Caso più comune - inizio paginazione
      const page = 1;
      const limit = 10;

      // Act
      const result = calculateOffset(page, limit);

      // Assert
      expect(result).toBe(0);
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it("tC2-BB: Seconda pagina con limit standard (Classe Equiv. Valida)", () => {
      // Arrange: Scenario tipico di navigazione
      const page = 2;
      const limit = 10;

      // Act
      const result = calculateOffset(page, limit);

      // Assert
      expect(result).toBe(10);
      expect(result).toBe((page - 1) * limit); // Verifica formula
    });

    it("tC3-BB: Terza pagina con limit = 20 (Classe Equiv. Valida)", () => {
      // Arrange
      const page = 3;
      const limit = 20;

      // Act
      const result = calculateOffset(page, limit);

      // Assert
      expect(result).toBe(40); // (3-1)*20 = 40
    });

    it("tC4-BVA: Limite minimo singolo (Boundary Value limit=1)", () => {
      // Arrange: Caso edge - un record per pagina
      const page = 5;
      const limit = 1;

      // Act
      const result = calculateOffset(page, limit);

      // Assert
      expect(result).toBe(4); // (5-1)*1 = 4
    });

    it("tC5-BB: Paginazione profonda (Large Numbers) - page=100", () => {
      // Arrange: Scenario di dataset molto grande
      const page = 100;
      const limit = 50;

      // Act
      const result = calculateOffset(page, limit);

      // Assert
      expect(result).toBe(4950); // (100-1)*50 = 4950
      expect(result).toBeGreaterThan(0);
    });

    it("tC6-BB: Limit molto grande (Classe Equiv. Large Limit)", () => {
      // Arrange: Poche pagine con molti record ciascuna
      const page = 2;
      const limit = 500;

      // Act
      const result = calculateOffset(page, limit);

      // Assert
      expect(result).toBe(500); // (2-1)*500 = 500
    });

    it("tC7-WB: Paginazione estrema (Statement Coverage - valori elevati)", () => {
      // Arrange: Test per verificare che non ci siano overflow
      const page = 1000;
      const limit = 100;

      // Act
      const result = calculateOffset(page, limit);

      // Assert
      expect(result).toBe(99900); // (1000-1)*100
      expect(typeof result).toBe("number");
      expect(Number.isInteger(result)).toBe(true);
    });

    it("tC8-BVA: Combinazione limiti (page=1, limit=1) - Offset minimo assoluto", () => {
      // Arrange: Caso minimo teorico
      const page = 1;
      const limit = 1;

      // Act
      const result = calculateOffset(page, limit);

      // Assert
      expect(result).toBe(0);
    });

    it("tC9-BB: Verifica tipo ritorno (Requisito Non Funzionale)", () => {
      // Arrange
      const page = 5;
      const limit = 20;

      // Act
      const result = calculateOffset(page, limit);

      // Assert: Deve essere un numero intero non decimale
      expect(typeof result).toBe("number");
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBe(80);
    });

    it("tC10-WB: Formula matematica corretta (Statement Coverage)", () => {
      // Arrange: Valori arbitrari per verifica formula
      const page = 7;
      const limit = 15;
      const expectedOffset = (page - 1) * limit;

      // Act
      const result = calculateOffset(page, limit);

      // Assert: Confronto con calcolo indipendente
      expect(result).toBe(expectedOffset);
      expect(result).toBe(90);
    });
  });
});
