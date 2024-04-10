# ts-agent-monitoring
AWS Cloud Development Kit application for setting up TetraScience Agent metrics and monitoring.

## Getting started

- Install Node.js 20 or higher (We recommend using nvm if you have to work with multiple versions on the same machine)
- Follow the AWS Cloud Development Kit [Getting Started instructions](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html)

> This repository contains [devcontainer](https://code.visualstudio.com/docs/devcontainers/containers) configuration to enable quick setup without worrying about dependencies.  If you're comfortable, this is the easiest way to get the proper development and runtime stack including Node.js, TypeScript, AWS CLI and AWS CDK.  You still need to follow the [AWS CDK Getting Started instructions](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html) in order to create and prepare your AWS account, but you don't need to install the AWS CDK CLI.

- Run `npm install` in the root of the repository
- The following parameters are required to run and deploy the app.  They may be specified as [context](https://docs.aws.amazon.com/cdk/v2/guide/context.html) parameters or environment variables.

| Context      | Environment Variable | Description                                                                                | Example                      |
| ------------ | -------------------- | ------------------------------------------------------------------------------------------ | ---------------------------- |
| tsApiBaseUrl | TS_API_BASE_URL      | The base URL for the API of your TetraScience environment                                  | https://api.tetrascience.com |
| tsOrgSlug    | TS_ORG_SLUG          | The slug for the TetraScience org                                                          | development                  |
| account      | CDK_DEFAULT_ACCOUNT  | The AWS account number of the account you want to deploy to (only required for deployment) | 123456789012                 |
| region       | CDK_DEFAULT_REGION   | The AWS region you want to deploy to (only required for deployment)                        | us-east-2                    |

- Optionally, you may specify a specific agent for testing purposes.

| Context   | Environment Variable | Description                                                            | Example                              |
| --------- | -------------------- | ---------------------------------------------------------------------- | ------------------------------------ |
| tsAgentId | TS_AGENT_ID          | An optional ID for a specific agent to create monitoring resources for | 55953bf0-acb6-4a45-beb6-cb30b33d4941 |

> The AWS Account and Region you specify must be [bootstrapped for AWS CDK deployment](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html#getting_started_bootstrap).

- Run `cdk synth` to synthesize the CloudFormation template locally. This will build and run the application, but won't deploy anything.
```bash
cdk synth --context tsApiBaseUrl=https://api.tetrascience.com --context tsAuthToken=**** --context tsOrgSlug=development --context accountId=123456789012 --context region=us-east-2 --profile my-profile
```

### Scripts

The following `npm` scripts are defined for convenience:
- `npm run build` compiles the project using `tsc`
- `npm run watch` enables `tsc` compiling in [watch mode](https://www.typescriptlang.org/docs/handbook/configuring-watch.html)
- `npm test` runs unit tests and runs format
- `npm run format` checks and applies style and linting fixes

> See [package.json](./package.json) for the full list.

## Overview

The TetraScience Agents produce a number of structured logs and metrics which provide insight into the execution of the agents. There is not, however, a productized solution for monitoring these metrics.  This repository is a showcase of how to leverage AWS CloudWatch to build a monitoring system (metrics and alarms) for your agents.

### Metrics

| Metric | Pattern | Dimensions | Value |
| ------ | ------- | ---------- | ----- |
| AgentMonitoring/PerPathScanDurationInMs | { $.event.type = "agents.filelog.scanCompleted.v1" } | - orgSlug<br>- agentId<br>- path | Scan duration in milliseconds |
| AgentMonitoring/FileUploadLatencyInSeconds | { $.event.type = "agents.filelog.fileUploadCompleted.v1" } | - orgSlug<br>- agentId | Upload latency in seconds |
| AgentMonitoring/HeartBeatCount | { $.event.type = "agents.common.heartbeat.v1" } | - orgSlug<br>- agentId | 1 |
| AgentMonitoring/PerPathScanCompletedCount | { $.event.type = "agents.filelog.scanCompleted.v1" } | - orgSlug<br>- agentId<br>- path | 1 |
| AgentMonitoring/PerPathValidationFailedCount | { $.event.type = "agents.filelog.pathValidationFailed.v1" } | - orgSlug<br>- agentId<br>- path | 1 |
| AgentMonitoring/PerPathScanErrorCount | { $.event.type = "agents.filelog.scanError.v1" } | - orgSlug<br>- agentId<br>- path | 1 |
| AgentMonitoring/UploadCompletedCount | { $.event.type = "agents.filelog.fileUploadCompleted.v1" } | - orgSlug<br>- agentId | 1 |
| AgentMonitoring/UploadFailedCount | { $.event.type = "agents.filelog.fileUploadFailed.v1" } | - orgSlug<br>- agentId | 1 |
| AgentMonitoring/ArchiveCompletedCount | { $.event.type = "agents.filelog.fileArchiveCompleted.v1" } | - orgSlug<br>- agentId | 1 |
| AgentMonitoring/ArchiveFailedCount | { $.event.type = "agents.filelog.fileArchiveFailed.v1" } | - orgSlug<br>- agentId | 1 |
| AgentMonitoring/DeleteCompletedCount | { $.event.type = "agents.filelog.archiveFileDeleteCompleted.v1" } | - orgSlug<br>- agentId | 1 |
| AgentMonitoring/DeleteFailedCount | { $.event.type = "agents.filelog.archiveFileDeleteFailed.v1" } | - orgSlug<br>- agentId | 1 |

## Deployment

> You must configure [AWS authentication](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html#getting_started_auth) in order to deploy.

Deployment is done via the AWS CDK `deploy` command.  Deployment requires the same parameters described above in Getting Started.
```bash
cdk deploy --context tsApiBaseUrl=https://api.tetrascience.com --context tsAuthToken=**** --context tsOrgSlug=development --context accountId=123456789012 --context region=us-east-2 --profile my-profile
```

## Contribute

We welcome contributions from the community that improve observability and monitoring of the agents. [Here are more details on how to contribute.](https://github.com/tetrascience/ts-agent-monitoring/blob/main/CONTRIBUTING.md)

## Disclaimer

The AWS Cloud Development Kit application in this repository is not fully a supported product feature. It is an example to demonstrate the monitoring options available for TetraScience Agents. You are responsible for any code maintenance, deployment, and validation using this project.
