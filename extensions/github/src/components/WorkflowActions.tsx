import { Action, ActionPanel, Icon, showToast, Toast } from "@raycast/api";
import { MutatePromise } from "@raycast/utils";
import { Octokit } from "octokit";

import { getErrorMessage } from "../helpers/errors";
import { addFavoriteWorkflow, isFavoriteWorkflow } from "../helpers/favorite-workflows";
import { getGitHubClient } from "../helpers/withGithubClient";
import { WorkflowsResponse } from "../workflows";

import { WorkflowForm } from "./WorkflowForm";

export type Workflow = WorkflowsResponse["data"]["workflows"][0];

export function getLastPathComponent(url: string): string {
  return url.split("/").slice(-1)[0];
}

export function createWorkflowURL(workflow: Workflow): string {
  const ymlFile = getLastPathComponent(workflow.path);
  const path = getURLPathExceptLastPathComponent(workflow.url);
  const url = replaceStringWithStringInPath(path, "https://api.github.com/repos/", "https://github.com/");
  const workflowURL = addPathComponentToURL(url, ymlFile);
  return workflowURL;
}

export async function runWorkflow(
  workflow: Workflow,
  repository: string,
  branch: string,
  inputs: any
) {
  await showToast({ style: Toast.Style.Animated, title: "Sending run request" });

  const { octokit } = getGitHubClient();
  const [owner, repo] = repository.split("/");

  try {
    await octokit.rest.actions.createWorkflowDispatch({
      owner: owner,
      repo: repo,
      workflow_id: workflow.id,
      ref: branch,
      inputs: inputs,
    });

    await showToast({
      style: Toast.Style.Success,
      title: "Sent run request",
    });
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Failed sending run request",
      message: getErrorMessage(error),
    });
  }
}

type WorkflowActionsProps = {
  workflow: Workflow;
  workflows: Workflow[];
  repository: string;
  branches: any[];
  defaultBranch: string;
  favorites: Workflow[];
  onUpdateFavorites: (favorites: Workflow[]) => void;
  mutateList: MutatePromise<WorkflowsResponse | undefined>;
};

function getURLPathExceptLastPathComponent(url: string): string {
  return url.split("/").slice(0, -1).join("/");
}

function replaceStringWithStringInPath(path: string, stringToReplace: string, replacement: string): string {
  return path.replace(stringToReplace, replacement);
}

function addPathComponentToURL(url: string, pathComponent: string): string {
  return url + "/" + pathComponent;
}

export function WorkflowActions({
  workflow,
  workflows,
  repository,
  branches,
  defaultBranch,
  favorites,
  onUpdateFavorites,
  mutateList,
}: WorkflowActionsProps) {
  const { octokit } = getGitHubClient();

  function favoriteActionTitle(workflow: Workflow, favorites: Workflow[]) {
    return isFavoriteWorkflow(workflow, favorites) ? "Remove From Favorites" : "Add To Favorites";
  }

  function favoriteActionIcon(workflow: Workflow, favorites: Workflow[]) {
    return isFavoriteWorkflow(workflow, favorites) ? Icon.StarDisabled : Icon.Star;
  }

  return (
    <ActionPanel>
      <Action.OpenInBrowser url={createWorkflowURL(workflow)} />
      <ActionPanel.Section>
        <Action.Push
          title="Run With Options"
          icon={Icon.List}
          target={<WorkflowForm repository={repository} workflow={workflow} branches={branches} />}
          shortcut={{ modifiers: ["cmd"], key: "enter" }}
        />
        <Action
          title="Run With Defaults"
          icon={Icon.Clock}
          shortcut={{ modifiers: ["cmd", "shift"], key: "enter" }}
          onAction={() => {
            runWorkflow(workflow, repository, defaultBranch, {});
          }}
        />
      </ActionPanel.Section>
      <ActionPanel.Section>
        <Action
          title={favoriteActionTitle(workflow, favorites)}
          icon={favoriteActionIcon(workflow, favorites)}
          shortcut={{ modifiers: ["cmd", "shift"], key: "f" }}
          onAction={() => {
            addFavoriteWorkflow(workflow, workflows, onUpdateFavorites);
          }}
        />
      </ActionPanel.Section>
    </ActionPanel>
  );
}
