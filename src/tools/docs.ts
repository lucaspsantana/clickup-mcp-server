import type { AxiosInstance } from "axios";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DocKind, DocParentType } from "../client.js";

function jsonText(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

async function setFirstPageContent(
  client: AxiosInstance,
  teamId: string,
  docId: string,
  name: string,
  content: string,
) {
  const pagesRes = await client.get(`/api/v3/workspaces/${teamId}/docs/${docId}/pages`);
  const pages = pagesRes.data?.pages ?? pagesRes.data ?? [];
  const firstPage = Array.isArray(pages) ? pages[0] : null;

  if (firstPage?.id) {
    await client.put(`/api/v3/workspaces/${teamId}/docs/${docId}/pages/${firstPage.id}`, {
      content,
      content_format: "text/md",
      content_edit_mode: "replace",
    });
    return;
  }

  await client.post(`/api/v3/workspaces/${teamId}/docs/${docId}/pages`, {
    name,
    content,
    content_format: "text/md",
  });
}

export function registerDocTools(server: McpServer, client: AxiosInstance, teamId: string) {
  server.registerTool(
    "clickup_list_docs",
    {
      description:
        "Search/list ClickUp Docs and Wikis in the workspace. Use doc_type to filter: doc, wiki, or all.",
      inputSchema: {
        query: z.string().optional().describe("Search by name"),
        doc_type: z.enum(["doc", "wiki", "all"]).optional().default("all"),
        limit: z.number().optional().default(50),
      },
    },
    async ({ query, doc_type, limit }) => {
      const { data } = await client.get(`/api/v3/workspaces/${teamId}/docs`, {
        params: {
          limit,
          ...(query ? { query } : {}),
        },
      });

      let docs = data.docs ?? data ?? [];
      if (!Array.isArray(docs)) docs = [];

      if (doc_type === "doc") {
        docs = docs.filter((d: { type?: number }) => d.type === DocKind.Doc);
      } else if (doc_type === "wiki") {
        docs = docs.filter((d: { type?: number }) => d.type === DocKind.Wiki);
      }

      return jsonText({ count: docs.length, docs });
    },
  );

  server.registerTool(
    "clickup_list_doc_pages",
    {
      description: "List pages inside a ClickUp Doc or Wiki",
      inputSchema: {
        doc_id: z.string(),
      },
    },
    async ({ doc_id }) => {
      const { data } = await client.get(`/api/v3/workspaces/${teamId}/docs/${doc_id}/pages`);
      return jsonText(data);
    },
  );

  server.registerTool(
    "clickup_create_doc",
    {
      description:
        "Create a ClickUp Doc. Optionally attach to a Space, Folder, or List via parent_id.",
      inputSchema: {
        name: z.string().describe("Doc title"),
        content: z.string().optional().describe("Markdown content for the first page"),
        parent_id: z.string().optional().describe("Parent Space/Folder/List ID"),
        parent_type: z
          .enum(["space", "folder", "list", "workspace"])
          .optional()
          .default("workspace"),
        visibility: z.enum(["PUBLIC", "PRIVATE", "PERSONAL"]).optional().default("PRIVATE"),
      },
    },
    async ({ name, content, parent_id, parent_type, visibility }) => {
      const parentTypeMap = {
        space: DocParentType.Space,
        folder: DocParentType.Folder,
        list: DocParentType.List,
        workspace: DocParentType.Workspace,
      };

      const body: Record<string, unknown> = {
        name,
        visibility,
        create_page: true,
      };

      if (parent_id) {
        body.parent = { id: parent_id, type: parentTypeMap[parent_type] };
      } else if (parent_type === "workspace") {
        body.parent = { id: teamId, type: DocParentType.Workspace };
      }

      const { data: doc } = await client.post(`/api/v3/workspaces/${teamId}/docs`, body);

      if (content && doc?.id) {
        await setFirstPageContent(client, teamId, doc.id, name, content);
      }

      return jsonText(doc);
    },
  );

  server.registerTool(
    "clickup_edit_doc",
    {
      description: "Edit a page inside a ClickUp Doc. Updates page name and/or markdown content.",
      inputSchema: {
        doc_id: z.string(),
        page_id: z.string(),
        name: z.string().optional(),
        content: z.string().optional(),
        content_edit_mode: z.enum(["replace", "append", "prepend"]).optional().default("replace"),
      },
    },
    async ({ doc_id, page_id, name, content, content_edit_mode }) => {
      const body: Record<string, unknown> = {
        content_format: "text/md",
        content_edit_mode,
      };
      if (name !== undefined) body.name = name;
      if (content !== undefined) body.content = content;

      const { data } = await client.put(
        `/api/v3/workspaces/${teamId}/docs/${doc_id}/pages/${page_id}`,
        body,
      );
      return jsonText(data ?? { success: true, doc_id, page_id });
    },
  );

  server.registerTool(
    "clickup_create_wiki",
    {
      description: "Create a ClickUp Wiki attached to a Space.",
      inputSchema: {
        name: z.string().describe("Wiki title"),
        space_id: z.string().describe("Space ID where the wiki lives"),
        content: z.string().optional().describe("Markdown content for the first page"),
        visibility: z.enum(["PUBLIC", "PRIVATE", "PERSONAL"]).optional().default("PUBLIC"),
      },
    },
    async ({ name, space_id, content, visibility }) => {
      const { data: doc } = await client.post(`/api/v3/workspaces/${teamId}/docs`, {
        name,
        visibility,
        create_page: true,
        parent: { id: space_id, type: DocParentType.Space },
      });

      if (content && doc?.id) {
        await setFirstPageContent(client, teamId, doc.id, name, content);
      }

      return jsonText({ ...doc, kind: "wiki", space_id });
    },
  );

  server.registerTool(
    "clickup_edit_wiki",
    {
      description: "Edit a page inside a ClickUp Wiki (same API as Docs)",
      inputSchema: {
        wiki_id: z.string().describe("Wiki doc ID"),
        page_id: z.string(),
        name: z.string().optional(),
        content: z.string().optional(),
        content_edit_mode: z.enum(["replace", "append", "prepend"]).optional().default("replace"),
      },
    },
    async ({ wiki_id, page_id, name, content, content_edit_mode }) => {
      const body: Record<string, unknown> = {
        content_format: "text/md",
        content_edit_mode,
      };
      if (name !== undefined) body.name = name;
      if (content !== undefined) body.content = content;

      const { data } = await client.put(
        `/api/v3/workspaces/${teamId}/docs/${wiki_id}/pages/${page_id}`,
        body,
      );
      return jsonText(data ?? { success: true, wiki_id, page_id });
    },
  );
}
