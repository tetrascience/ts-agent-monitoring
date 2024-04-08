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

The TetraScience Agents produce a number of structured logs and metrics which provide insight into the execution of the agents. There is not, however, a productized solution for monitoring these metrics.  This repository is designed to be a starting point to leverage AWS CloudWatch to build a monitoring system (metrics and alarms) for your agents.

## Deployment

> You must configure [AWS authentication](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html#getting_started_auth) in order to deploy.

Deployment is done via the AWS CDK `deploy` command.  Deployment requires the same parameters described above in Getting Started.
```bash
cdk deploy --context tsApiBaseUrl=https://api.tetrascience.com --context tsAuthToken=**** --context tsOrgSlug=development --context accountId=123456789012 --context region=us-east-2 --profile my-profile
```

## Contribute

We welcome contributions from the community that improve observability and monitoring of the agents. [Here are more details on how to contribute.](https://github.com/tetrascience/ts-agent-monitoring/blob/main/Contributing.md)

## Disclaimer

The AWS Cloud Development Kit application in this repository is not fully a supported product feature. It is an example to demonstrate the monitoring options available for TetraScience Agents. You are responsible for any code maintenance, deployment, and validation using this project.
