import { Icon, LocalStorage } from "@raycast/api";

import { Workflow } from "../workflows";

export async function loadFavorites(workflows: Workflow[]) {
  const favoriteWorkflowIds = await getFavoriteWorkflowIds();
  let favoriteWorkflows: Workflow[] = [];
  favoriteWorkflowIds.forEach((workflowId) => {
    const matchingWorkflow = workflows.find((workflow) => workflow.id === workflowId);
    if (matchingWorkflow) {
      favoriteWorkflows.push(matchingWorkflow);
    }
  });

  // Sort favoriteworkflows by title
  favoriteWorkflows = sortWorkflows(favoriteWorkflows);
  return favoriteWorkflows;
}

export function isFavoriteWorkflow(workflow: Workflow, favorites: Workflow[]) {
  return favorites.some((favorite) => favorite.id === workflow.id);
}

export async function getFavoriteWorkflowIds(): Promise<[number]> {
  const favoriteWorkflowIdsJSON = await LocalStorage.getItem<string>("favorite-workflows");
  const favoriteWorkflowIds = JSON.parse(favoriteWorkflowIdsJSON ?? "[]");
  return favoriteWorkflowIds;
}

export async function addFavoriteWorkflow(
  workflow: Workflow,
  workflows: Workflow[],
  onUpdateFavorites: (favorites: Workflow[]) => void
) {
  const favoriteWorkflows = await getFavoriteWorkflowIds();
  const existingFavoriteIndex = favoriteWorkflows.indexOf(workflow.id);
  if (existingFavoriteIndex !== -1) {
    favoriteWorkflows.splice(existingFavoriteIndex, 1);
  } else {
    favoriteWorkflows.push(workflow.id);
  }
  await LocalStorage.setItem("favorite-workflows", JSON.stringify(favoriteWorkflows));
  onUpdateFavorites(await loadFavorites(workflows));
}

export function accessoryIconForWorkflow(workflow: Workflow, favorites: Workflow[]) {
  const isFavorite = favorites.some((favorite) => favorite.id === workflow.id);
  return isFavorite ? Icon.Stars : null;
}

export function sortWorkflows(workflows: Workflow[]): Workflow[] {
  workflows.sort((a, b) => {
    if (a.name < b.name) {
      return -1;
    }
    if (a.name > b.name) {
      return 1;
    }
    return 0;
  });
  return workflows;
}
