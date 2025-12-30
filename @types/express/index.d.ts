import type { AnyZodObject } from "zod";

declare global {
  namespace Express {
    interface User {
      id: number;
      name: string | null;
      email: string | null;
      phone: string | null; // Cambiato da string a string | null
      password: string;
      roleId: number;
      agencyId: number | null;
      hasCreatedAgency: boolean | null;
      createdAt: string;
      updatedAt: string;
      role: string | null; // Cambiato da optional a string | null
    }

    interface Request<Params extends AnyZodObject = AnyZodObject> {
      user?: User;
      posts?: {
        id: number;
        title: string;
        description: string | null;
        address: string;
        city: string;
        cap: number;
        price: string;
        listingType: "vendita" | "affitto";
        rooms: number | null;
        size: number | null;
        floor: number | null;
        hasElevator: boolean | null;
        energyClass: string | null;
        createdAt: string;
        updatedAt: string;
        userId: number;
        agencyId: number | null;
        location: unknown;
      };
      files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] } | undefined;
    }
  }
}

export {};
