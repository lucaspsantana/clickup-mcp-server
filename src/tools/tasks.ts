import type { AxiosInstance } from "axios";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

function jsonText(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function registerTaskTools(server: McpServer, client: AxiosInstance, teamId: string) {
  server.registerTool(
    "clickup_list_tasks",
    {
      description:
        "List ClickUp tasks. Filter by list_id, status, assignee, or search term. Uses team task filter when list_id is omitted.",
      inputSchema: {
        list_id: z.string().optional().describe("ClickUp list ID — if set, lists tasks in this list only"),
        status: z.string().optional().describe("Filter by status name, e.g. 'in progress'"),
        assignee_id: z.string().optional().describe("Filter by assignee user ID"),
        search: z.string().optional().describe("Search in task name and description"),
        include_closed: z.boolean().optional().default(false),
        page: z.number().optional().default(0),
      },
    },
    async ({ list_id, status, assignee_id, search, include_closed, page }) => {
      if (list_id) {
        const { data } = await client.get(`/api/v2/list/${list_id}/task`, {
          params: {
            archived: false,
            include_closed,
            subtasks: true,
            page,
            ...(status ? { statuses: [status] } : {}),
            ...(assignee_id ? { assignees: [assignee_id] } : {}),
          },
        });
        let tasks = data.tasks ?? [];
        if (search) {
          const q = search.toLowerCase();
          tasks = tasks.filter(
            (t: { name?: string; description?: string }) =>
              t.name?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q),
          );
        }
        return jsonText({ count: tasks.length, tasks });
      }

      const { data } = await client.get(`/api/v2/team/${teamId}/task`, {
        params: {
          page,
          include_closed,
          subtasks: true,
          ...(status ? { statuses: [status] } : {}),
          ...(assignee_id ? { assignees: [assignee_id] } : {}),
        },
      });
      let tasks = data.tasks ?? [];
      if (search) {
        const q = search.toLowerCase();
        tasks = tasks.filter(
          (t: { name?: string; description?: string }) =>
            t.name?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q),
        );
      }
      return jsonText({ count: tasks.length, tasks });
    },
  );

  server.registerTool(
    "clickup_update_task",
    {
      description: "Update a ClickUp task by task_id",
      inputSchema: {
        task_id: z.string().describe("ClickUp task ID"),
        name: z.string().optional(),
        description: z.string().optional(),
        status: z.string().optional().describe("Status name in the list"),
        priority: z.number().optional().describe("1=urgent, 2=high, 3=normal, 4=low"),
        due_date: z.number().optional().describe("Unix timestamp in milliseconds"),
        assignees_add: z.array(z.string()).optional().describe("User IDs to add as assignees"),
        assignees_rem: z.array(z.string()).optional().describe("User IDs to remove from assignees"),
      },
    },
    async ({ task_id, name, description, status, priority, due_date, assignees_add, assignees_rem }) => {
      const body: Record<string, unknown> = {};
      if (name !== undefined) body.name = name;
      if (description !== undefined) body.description = description;
      if (status !== undefined) body.status = status;
      if (priority !== undefined) body.priority = priority;
      if (due_date !== undefined) body.due_date = due_date;
      if (assignees_add?.length) body.assignees = { add: assignees_add };
      if (assignees_rem?.length) {
        body.assignees = { ...(body.assignees as object), rem: assignees_rem };
      }

      const { data } = await client.put(`/api/v2/task/${task_id}`, body);
      return jsonText(data);
    },
  );
}
