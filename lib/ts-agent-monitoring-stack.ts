import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as lambda_nodejs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as destinations from 'aws-cdk-lib/aws-logs-destinations'
import { Runtime } from 'aws-cdk-lib/aws-lambda'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'

export interface Agent {
  id: string
  type: string
  orgSlug: string
}

interface AgentMonitoringStackProps extends cdk.StackProps {
  agents: Agent[]
  tsApiUrl: string
  tsAuthToken: string
}

export class TsAgentMonitoringStack extends cdk.Stack {
  readonly fileLogAgentStacks: { [id: string]: FileLogAgentMonitoringStack } = {}

  constructor(scope: Construct, id: string, props: AgentMonitoringStackProps) {
    super(scope, id, props)

    // create a secret for the auth token
    // todo: if an existing secret name is passed in, use it instead
    const tsAuthTokenSecret = new secretsmanager.Secret(this, 'tsAuthTokenSecret', {
      secretStringValue: cdk.SecretValue.unsafePlainText(props.tsAuthToken),
    })

    const fileLogAgentMetricsGenerationLambda = new lambda_nodejs.NodejsFunction(this, 'fla-metrics-lambda', {
      runtime: Runtime.NODEJS_20_X,
      environment: {
        TETRASCIENCE_API_URL: props.tsApiUrl,
        TETRASCIENCE_AUTH_TOKEN_SECRET_ARN: tsAuthTokenSecret.secretArn,
      },
    })

    fileLogAgentMetricsGenerationLambda.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'], // todo: scope this down
      }),
    )

    fileLogAgentMetricsGenerationLambda.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [tsAuthTokenSecret.secretArn],
      }),
    )

    const agents = props.agents

    const createAgentTags = (agent: Agent) => ({
      agentId: agent.id,
      agentType: agent.type,
      orgSlug: agent.orgSlug,
    })

    const fileLogAgents = agents.filter((agent) => agent.type === 'file-log')

    fileLogAgents.forEach((agent) => {
      const tags = createAgentTags(agent)
      this.fileLogAgentStacks[agent.id] = new FileLogAgentMonitoringStack(
        this,
        `FileLogAgentMonitoringStack-${agent.id}`,
        {
          agent,
          metricsLambda: fileLogAgentMetricsGenerationLambda,
          tags,
        },
      )
    })

    const empowerAgents = agents.filter((agent) => agent.type === 'empower')
    empowerAgents.forEach(() => {})
  }
}

interface AgentStackProps extends cdk.StackProps {
  agent: Agent
  metricsLambda: lambda_nodejs.NodejsFunction
}

class FileLogAgentMonitoringStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: AgentStackProps) {
    super(scope, id, props)

    const agent = props.agent
    const logGroup = logs.LogGroup.fromLogGroupName(this, `LogGroup${agent.id}`, `/agents/${agent.orgSlug}/${agent.id}`)

    new logs.SubscriptionFilter(this, 'MetricsSubscriptionFilter', {
      logGroup: logGroup,
      destination: new destinations.LambdaDestination(props.metricsLambda),
      filterPattern: logs.FilterPattern.any(
        logs.FilterPattern.stringValue('$.event.type', '=', 'agents.filelog.scanCompleted.v1'),
        logs.FilterPattern.stringValue('$.event.type', '=', 'agents.filelog.fileUploadCompleted.v1'),
      ),
      filterName: `MetricsSubscriptionFilter-${agent.id}`,
    })

    new logs.MetricFilter(this, `HeartBeat-${agent.id}`, {
      logGroup: logGroup,
      filterName: `HeartBeat-${agent.id}`,
      filterPattern: logs.FilterPattern.stringValue('$.event.type', '=', 'agents.common.heartbeat.v1'),
      metricNamespace: 'AgentMonitoring',
      metricName: 'HeartBeatCount',
      metricValue: '1',
      dimensions: {
        orgSlug: '$.orgSlug',
        agentId: '$.event.component.id',
      },
    })

    new logs.MetricFilter(this, `PerPathScanCompleted-${agent.id}`, {
      logGroup: logGroup,
      filterName: `PerPathScanCompleted-${agent.id}`,
      filterPattern: logs.FilterPattern.stringValue('$.event.type', '=', 'agents.filelog.scanCompleted.v1'),
      metricNamespace: 'AgentMonitoring',
      metricName: 'PerPathScanCompletedCount',
      metricValue: '1',
      dimensions: {
        orgSlug: '$.orgSlug',
        agentId: '$.event.component.id',
        path: '$.event.data.path',
      },
    })

    new logs.MetricFilter(this, `PerPathValidationFailed-${agent.id}`, {
      logGroup: logGroup,
      filterName: `PerPathValidationFailed-${agent.id}`,
      filterPattern: logs.FilterPattern.stringValue('$.event.type', '=', 'agents.filelog.pathValidationFailed.v1'),
      metricNamespace: 'AgentMonitoring',
      metricName: 'PerPathValidationFailedCount',
      metricValue: '1',
      dimensions: {
        orgSlug: '$.orgSlug',
        agentId: '$.event.component.id',
        path: '$.event.data.path',
      },
    })

    new logs.MetricFilter(this, `PerPathScanError-${agent.id}`, {
      logGroup: logGroup,
      filterName: `PerPathScanError-${agent.id}`,
      filterPattern: logs.FilterPattern.stringValue('$.event.type', '=', 'agents.filelog.scanError.v1'),
      metricNamespace: 'AgentMonitoring',
      metricName: 'PerPathScanErrorCount',
      metricValue: '1',
      dimensions: {
        orgSlug: '$.orgSlug',
        agentId: '$.event.component.id',
        path: '$.event.data.path',
      },
    })

    new logs.MetricFilter(this, `UploadCompleted-${agent.id}`, {
      logGroup: logGroup,
      filterName: `UploadCompleted-${agent.id}`,
      filterPattern: logs.FilterPattern.stringValue('$.event.type', '=', 'agents.filelog.fileUploadCompleted.v1'),
      metricNamespace: 'AgentMonitoring',
      metricName: 'UploadCompletedCount',
      metricValue: '1',
      dimensions: {
        orgSlug: '$.orgSlug',
        agentId: '$.event.component.id',
      },
    })

    new logs.MetricFilter(this, `UploadFailed-${agent.id}`, {
      logGroup: logGroup,
      filterName: `UploadFailed-${agent.id}`,
      filterPattern: logs.FilterPattern.stringValue('$.event.type', '=', 'agents.filelog.fileUploadFailed.v1'),
      metricNamespace: 'AgentMonitoring',
      metricName: 'UploadFailedCount',
      metricValue: '1',
      dimensions: {
        orgSlug: '$.orgSlug',
        agentId: '$.event.component.id',
      },
    })

    new logs.MetricFilter(this, `ArchiveCompleted-${agent.id}`, {
      logGroup: logGroup,
      filterName: `ArchiveCompleted-${agent.id}`,
      filterPattern: logs.FilterPattern.stringValue('$.event.type', '=', 'agents.filelog.fileArchiveCompleted.v1'),
      metricNamespace: 'AgentMonitoring',
      metricName: 'ArchiveCompletedCount',
      metricValue: '1',
      dimensions: {
        orgSlug: '$.orgSlug',
        agentId: '$.event.component.id',
      },
    })

    new logs.MetricFilter(this, `ArchiveFailed-${agent.id}`, {
      logGroup: logGroup,
      filterName: `ArchiveFailed-${agent.id}`,
      filterPattern: logs.FilterPattern.stringValue('$.event.type', '=', 'agents.filelog.fileArchiveFailed.v1'),
      metricNamespace: 'AgentMonitoring',
      metricName: 'ArchiveFailedCount',
      metricValue: '1',
      dimensions: {
        orgSlug: '$.orgSlug',
        agentId: '$.event.component.id',
      },
    })

    new logs.MetricFilter(this, `DeleteCompleted-${agent.id}`, {
      logGroup: logGroup,
      filterName: `DeleteCompleted-${agent.id}`,
      filterPattern: logs.FilterPattern.stringValue(
        '$.event.type',
        '=',
        'agents.filelog.archiveFileDeleteCompleted.v1',
      ),
      metricNamespace: 'AgentMonitoring',
      metricName: 'DeleteCompletedCount',
      metricValue: '1',
      dimensions: {
        orgSlug: '$.orgSlug',
        agentId: '$.event.component.id',
      },
    })

    new logs.MetricFilter(this, `DeleteFailed-${agent.id}`, {
      logGroup: logGroup,
      filterName: `DeleteFailed-${agent.id}`,
      filterPattern: logs.FilterPattern.stringValue('$.event.type', '=', 'agents.filelog.archiveFileDeleteFailed.v1'),
      metricNamespace: 'AgentMonitoring',
      metricName: 'DeleteFailedCount',
      metricValue: '1',
      dimensions: {
        orgSlug: '$.orgSlug',
        agentId: '$.event.component.id',
      },
    })
  }
}
