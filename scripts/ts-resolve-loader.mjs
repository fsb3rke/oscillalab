import fs from "node:fs";
import { register } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

register(
  "data:text/javascript," +
    encodeURIComponent(`
      import fs from "node:fs";
      import { fileURLToPath, pathToFileURL } from "node:url";

      export async function resolve(specifier, context, nextResolve) {
        try {
          return await nextResolve(specifier, context);
        } catch (err) {
          if (
            (specifier.startsWith("./") || specifier.startsWith("../")) &&
            context.parentURL
          ) {
            const base = fileURLToPath(new URL(specifier, context.parentURL));
            for (const candidate of [base + ".ts", base + "/index.ts"]) {
              if (fs.existsSync(candidate)) {
                return { url: pathToFileURL(candidate).href, shortCircuit: true };
              }
            }
          }
          throw err;
        }
      }
    `)
);
