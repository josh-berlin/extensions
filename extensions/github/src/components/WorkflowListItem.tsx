import { List } from "@raycast/api";
import { MutatePromise } from "@raycast/utils";

import { accessoryIconForWorkflow } from "../helpers/favorite-workflows";
import { WorkflowsResponse } from "../workflows";

import { getLastPathComponent } from "./WorkflowActions";
import { Workflow, WorkflowActions } from "./WorkflowActions";

type WorkflowListItemProps = {
  workflow: Workflow;
  workflows: Workflow[];
  repository: string;
  branches: any[];
  defaultBranch: string;
  favorites: Workflow[];
  onUpdateFavorites: (favorites: Workflow[]) => void;
  mutateList: MutatePromise<WorkflowsResponse | undefined>;
};

export function WorkflowListItem({
  workflow,
  workflows,
  repository,
  branches,
  defaultBranch,
  favorites,
  onUpdateFavorites,
  mutateList,
}: WorkflowListItemProps) {
  const accessories: List.Item.Accessory[] = [
    {
      text: getLastPathComponent(workflow.path),
      tooltip: workflow.path,
      icon: accessoryIconForWorkflow(workflow, favorites),
    },
  ];

  return (
    <List.Item
      title={workflow.name}
      accessories={accessories}
      actions={
        <WorkflowActions
          workflow={workflow}
          workflows={workflows}
          repository={repository}
          branches={branches}
          defaultBranch={defaultBranch}
          favorites={favorites}
          onUpdateFavorites={onUpdateFavorites}
          mutateList={mutateList}
        />
      }
    />
  );
}
