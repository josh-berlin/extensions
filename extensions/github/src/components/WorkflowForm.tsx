import { Action, ActionPanel, Form, Icon, showToast, Toast } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import yaml from "js-yaml";
import { Octokit } from "octokit";
import { useState } from "react";

import { getErrorMessage } from "../helpers/errors";
import { getGitHubClient } from "../helpers/withGithubClient";
import { useMyRepositories } from "../hooks/useRepositories";
import { Workflow } from "../workflows";

import { createWorkflowURL, runWorkflow } from "./WorkflowActions";

type WorkflowFormProps = {
  repository: string;
  workflow: Workflow;
  branches: any[];
};

interface WorkflowConfig {
  on: {
    workflow_dispatch: {
      inputs: Input[];
    };
  };
}

type Input = {
  name: string;
  description: string;
  default: string;
  required: boolean;
  type: string;
  options: string[];
};

/**
 * Fetches the content of a workflow file.
 */
async function getWorkflowContent(octokit: Octokit, repo: string, owner: string, workflow: Workflow) {
  const response = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
    owner: owner,
    repo: repo,
    path: workflow.path,
  });
  const { data } = response;
  if ("content" in data && data.content.length > 0 && data.content) {
    return data.content;
  } else {
    throw new Error("No content found");
  }
}

/**
 * Get the inputs from the workflow file.
 *
 * @param content The content of the workflow file
 * @returns A Promise that resolves to an array of Input objects.
 * @throws An error if the YAML content is invalid or if the workflow_dispatch trigger is not found.
 */
async function getWorkflowInputs(content: string): Promise<Input[]> {
  if (content.length == 0) {
    return [];
  }

  const buff = Buffer.from(content, "base64");
  const text = buff.toString("utf-8");
  let obj: WorkflowConfig;
  try {
    obj = yaml.load(text) as WorkflowConfig;
  } catch (e) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Workflow cannot be run",
      message: "Error loading workflow configuration",
    });
    return [];
  }

  const workflowDispatch = obj.on.workflow_dispatch;
  if (!workflowDispatch) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Workflow cannot be run",
      message: "No workflow_dispatch trigger found",
    });
    return [];
  }

  if (!workflowDispatch.inputs) {
    return [];
  }

  const inputs = workflowDispatch.inputs;
  const inputsList: Input[] = [];
  for (const key in inputs) {
    if (Object.prototype.hasOwnProperty.call(inputs, key)) {
      const value = inputs[key];
      inputsList.push({
        name: key,
        description: value.description,
        default: value.default,
        required: value.required,
        type: value.type,
        options: value.options,
      });
    }
  }
  return inputsList;
}

/**
 * Validates if all required workflow inputs are present in the form values.
 *
 * @param inputs The inputs in the workflow.
 * @param values The values in the form.
 * @returns Returns true if all required inputs are present in the form's values object. If any required input is missing, returns false.
 */
function validateFormValues(inputs: Input[], values: Form.Values) {
  const requiredInputs = inputs.filter((input) => input.required);
  for (const input of requiredInputs) {
    if (!values[input.name]) {
      throw new Error(`Input ${input.name} is required`);
    }
  }
  return true;
}

export function WorkflowForm({ repository, workflow, branches }: WorkflowFormProps) {
  const { github } = getGitHubClient();
  const { octokit } = getGitHubClient();

  const [owner, repo] = repository.split("/");
  const { data: repositories } = useMyRepositories();
  const { data: repositoryData, isLoading: repositoryIsLoading } = useCachedPromise(
    (repository) => {
      const selectedRepository = repositories?.find((r) => r.name === repo);

      if (!selectedRepository) {
        return Promise.resolve(null);
      }
      return github.dataForRepository({ owner: selectedRepository.owner.login, name: selectedRepository.name });
    },
    [repository]
  );

  const [selectedBranch, setSelectedBranch] = useState<string>(
    repositoryData?.repository?.defaultBranchRef?.name ?? ""
  );

  const { data: inputData, isLoading: inputIsLoading } = useCachedPromise(
    async (workflow) => {
      const content = await getWorkflowContent(octokit, repo, owner, workflow);
      return await getWorkflowInputs(content);
    },
    [workflow]
  );

  /**
   * Stores the input error strings.
   */
  const [inputErrors, setInputErrors] = useState<{ [name: string]: string }>({});

  /*
   * Updates the error messages based on the form value for the specified input.
   */
  const updateInputErrors = (name: string, value: string | undefined) => {
    const input = inputData?.find((input) => input.name === name);
    if (input && input.required && !value) {
      setInputErrors((prevState) => ({ ...prevState, [name]: `${name} is required` }));
    } else {
      setInputErrors((prevState) => ({ ...prevState, [name]: "" }));
    }
  };

  async function onSubmit(values: Form.Values) {
    try {
      if (!inputData) {
        return;
      }

      // Remove the branch from the form values, and pass the remaining values as inputs.
      delete values.branch;

      validateFormValues(inputData, values);

      await runWorkflow(workflow, repository, selectedBranch, values);
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Inputs are invalid",
        message: getErrorMessage(error),
      });
    }
  }

  return (
    <Form
      navigationTitle={workflow.name}
      actions={
        <ActionPanel>
          <Action.SubmitForm onSubmit={onSubmit} title="Run Workflow" icon={Icon.Clock} />
          <Action.OpenInBrowser title="Open In Browser" url={createWorkflowURL(workflow)} />
        </ActionPanel>
      }
      isLoading={inputIsLoading || repositoryIsLoading}
    >
      <Form.Dropdown
        id="branch"
        title="Branch"
        isLoading={repositoryIsLoading}
        value={selectedBranch}
        onChange={setSelectedBranch}
      >
        {branches
          ? branches.map((branch) => {
              if (!branch) {
                return null;
              }

              return <Form.Dropdown.Item key={branch.id} title={branch.name} value={branch.name} />;
            })
          : null}
      </Form.Dropdown>

      <Form.Separator />

      {inputData
        ? inputData?.map((input: Input) => {
            if (input.type == "choice") {
              return (
                <Form.Dropdown id={input.name} title={input.name} defaultValue={input.default}>
                  {input.options.map((option) => (
                    <Form.Dropdown.Item key={option} title={option} value={option} />
                  ))}
                </Form.Dropdown>
              );
            } else if (input.type == "boolean") {
              return (
                <Form.Checkbox
                  key={input.name}
                  id={input.name}
                  label={input.name}
                  defaultValue={input.default == "true" ? true : false}
                />
              );
            } else {
              return (
                <Form.TextField
                  key={input.name}
                  id={input.name}
                  title={input.name}
                  defaultValue={input.default}
                  onBlur={(event) => {
                    updateInputErrors(input.name, event.target.value);
                  }}
                  error={inputErrors[input.name]}
                />
              );
            }
          })
        : null}
    </Form>
  );
}
