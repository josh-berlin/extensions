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
  const ymlFileName = getLastPathComponent(workflow.path)
  const accessories: List.Item.Accessory[] = [
    {
      text: ymlFileName,
      tooltip: workflow.path,
      icon: accessoryIconForWorkflow(workflow, favorites),
    },
  ];

  return (
    <List.Item
      title={workflow.name}
      accessories={accessories}
      keywords={[ymlFileName]}
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
