// import type { Request } from "express";
// import type { ParamsDictionary } from "express-serve-static-core";
// import type { AnyZodObject, z } from "zod";

// import type { UserSelectSchema } from "@/db/schema/user";

// export interface RequestWithUser<
//   Params extends AnyZodObject = AnyZodObject,
//   Body extends AnyZodObject = AnyZodObject,
//   Query extends AnyZodObject = AnyZodObject,
// > extends Request<ParamsDictionary, any, any, any> {
//   user?: UserSelectSchema;
//   params: z.infer<Params> extends never ? { [key: string]: string } : z.infer<Params>;
//   body: z.infer<Body> extends never ? any : z.infer<Body>;
//   query: z.infer<Query> extends never ? any : z.infer<Query>;
// }
