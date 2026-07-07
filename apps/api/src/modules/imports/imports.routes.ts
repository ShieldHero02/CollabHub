import type { FastifyInstance } from "fastify";
import { requirePermission } from "../../http/auth.js";
import { importLegacyState, previewLegacyImport } from "./legacy-import.service.js";

export async function registerImportRoutes(server: FastifyInstance) {
  server.post("/api/imports/legacy/preview", async (request, reply) => {
    const user = await requirePermission(request, reply, "import:legacy");
    if (!user) return reply;
    return { data: previewLegacyImport(request.body) };
  });

  server.post("/api/imports/legacy", async (request, reply) => {
    const user = await requirePermission(request, reply, "import:legacy");
    if (!user) return reply;
    const result = await importLegacyState(request.body, user.id);
    return reply.code(201).send({ data: result });
  });
}
