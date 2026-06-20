import axios, { type AxiosInstance } from "axios";

export type ClickUpConfig = {
  apiKey: string;
  teamId: string;
};

export function createClickUpClient(config: ClickUpConfig): AxiosInstance {
  return axios.create({
    baseURL: "https://api.clickup.com",
    headers: {
      Authorization: config.apiKey,
      "Content-Type": "application/json",
    },
    timeout: 30_000,
  });
}

export function getConfig(): ClickUpConfig {
  const apiKey = process.env.CLICKUP_API_KEY;
  const teamId = process.env.CLICKUP_TEAM_ID;

  if (!apiKey) {
    throw new Error("CLICKUP_API_KEY is required");
  }
  if (!teamId) {
    throw new Error("CLICKUP_TEAM_ID is required");
  }

  return { apiKey, teamId };
}

/** ClickUp parent types for Docs v3 */
export const DocParentType = {
  Space: 4,
  Folder: 5,
  List: 6,
  Everything: 7,
  Workspace: 12,
} as const;

/** Doc type in list/search responses: 1 = Doc, 2 = Wiki */
export const DocKind = {
  Doc: 1,
  Wiki: 2,
} as const;
