import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  // Mappa gli alias definiti nel tsconfig.json (es. @/db -> src/db)
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // Ignora la build e i moduli
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  // Configurazione trasformazione TypeScript
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { isolatedModules: true }],
  },
  verbose: true,
};

export default config;