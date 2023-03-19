import { Endpoints } from "@octokit/types";
import { List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useState, useEffect } from "react";

import RepositoriesDropdown from "./components/RepositoryDropdown";
import View from "./components/View";
import { WorkflowListItem } from "./components/WorkflowListItem";
import { loadFavorites } from "./helpers/favorite-workflows";
import { getGitHubClient } from "./helpers/withGithubClient";
import { useMyRepositories } from "./hooks/useRepositories";

export type WorkflowsResponse = Endpoints["GET /repos/{owner}/{repo}/actions/workflows"]["response"];
export type Workflow = WorkflowsResponse["data"]["workflows"][0];

function sortWorkflowsByName(workflows: Workflow[]) {
  return workflows.sort((a, b) => {
    if (a.name < b.name) {
      return -1;
    }
    if (a.name > b.name) {
      return 1;
    }
    return 0;
  });
}

function Workflows() {
  const { octokit } = getGitHubClient();
  const { github } = getGitHubClient();

  // Load the workflows for the selected repository.
  const [selectedRepository, setSelectedRepository] = useState<string | null>(null);
  const {
    data,
    isLoading,
    mutate: mutateList,
  } = useCachedPromise(
    (repository) => {
      const [owner, repo] = repository.split("/");
      return octokit.request("GET /repos/{owner}/{repo}/actions/workflows", {
        owner: owner,
        repo: repo,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });
    },
    [selectedRepository],
    { execute: !!selectedRepository }
  );

  // Load the repository data for the selected repository.
  const { data: repositoryData, isLoading: repositoryIsLoading } = useCachedPromise(
    (repository) => {
      if (!selectedRepository) {
        return Promise.resolve(null);
      }

      const [owner, repo] = selectedRepository.split("/");
      return github.dataForRepository({ owner: owner, name: repo });
    },
    [selectedRepository]
  );

  const workflows = data?.data.workflows || [];
  const activeWorkflows = workflows.filter((workflow) => workflow.state === "active");
  const sortedActiveWorkflows = sortWorkflowsByName(activeWorkflows);
  const branches = repositoryData?.repository?.refs?.nodes ?? [];
  const defaultBranch = repositoryData?.repository?.defaultBranchRef?.name ?? "";

  // Load the favorites once the workflows load.
  const [favorites, setFavorites] = useState<Workflow[]>([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState<boolean>(true);
  useEffect(() => {
    async function loadAndSetFavorites() {
      const favorites = await loadFavorites(workflows);
      setFavorites(favorites);
      setIsLoadingFavorites(false);
    }

    if (workflows.length > 0) {
      loadAndSetFavorites();
    }
  }, [workflows]);

  // Wait for the favorites to load to render the 2nd section,
  // so the first favorite is selected by default.
  const [showAllWorkflowsSection, setShowAllWorkflowsSection] = useState<boolean>(false);
  useEffect(() => {
    if (!isLoadingFavorites) {
      setTimeout(() => {
        setShowAllWorkflowsSection(true);
      }, 1);
    }
  }, [isLoadingFavorites]);

  function workflowListItems(workflowsToShow: Workflow[]) {
    return workflowsToShow && workflowsToShow.length > 0 && selectedRepository
      ? workflowsToShow.map((workflow) => {
          return (
            <WorkflowListItem
              key={workflow.id}
              workflow={workflow}
              workflows={workflows}
              repository={selectedRepository}
              branches={branches}
              defaultBranch={defaultBranch}
              favorites={favorites}
              onUpdateFavorites={setFavorites}
              mutateList={mutateList}
            />
          );
        })
      : null;
  }

  return (
    <List
      isLoading={isLoading || repositoryIsLoading || isLoadingFavorites}
      searchBarPlaceholder="Filter by name or file name"
      searchBarAccessory={
        <RepositoriesDropdown setSelectedRepository={setSelectedRepository} withAllRepositories={false} />
      }
    >
      <List.Section title="Favorites">{workflowListItems(favorites)}</List.Section>

      {showAllWorkflowsSection && <List.Section title="All">{workflowListItems(sortedActiveWorkflows)}</List.Section>}
      <List.EmptyView title="No workflows found" />
    </List>
  );
}

export default function Command() {
  return (
    <View>
      <Workflows />
    </View>
  );
}
