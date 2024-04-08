import * as cdk from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import * as TsAgentMonitoring from '../lib/ts-agent-monitoring-stack'

test('FLA Lambda and MetricFilters Created', () => {
  const app = new cdk.App()
  const agent1Id = 'b4a31b69-0719-4d05-9ded-5677df4be65f'
  const agent2Id = '9cff0bce-119a-4fdd-aaf9-9201a1073bea'
  const agent3Id = 'f3691292-283b-4747-81dd-268dfe1229c8'
  const stack = new TsAgentMonitoring.TsAgentMonitoringStack(app, 'MyTestStack', {
    agents: [
      { id: agent1Id, orgSlug: 'test', type: 'file-log' },
      { id: agent2Id, orgSlug: 'test', type: 'file-log' },
      { id: agent3Id, orgSlug: 'test', type: 'empower' },
    ],
  })
  const template = Template.fromStack(stack)

  template.hasResourceProperties('AWS::Lambda::Function', { Handler: 'index.handler', Runtime: 'nodejs20.x' })
  template.hasResourceProperties('AWS::CloudFormation::Stack', {})

  const verifyFileLogAgentTemplate = (stack: TsAgentMonitoring.TsAgentMonitoringStack, agentId: string) => {
    const agentNestedStack = stack.fileLogAgentStacks[agentId]
    const agentTemplate = Template.fromStack(agentNestedStack)

    agentTemplate.hasResourceProperties('AWS::Logs::SubscriptionFilter', {})
    agentTemplate.hasResourceProperties('AWS::Logs::MetricFilter', { FilterName: `HeartBeat-${agentId}` })
    agentTemplate.hasResourceProperties('AWS::Logs::MetricFilter', { FilterName: `PerPathScanCompleted-${agentId}` })
    agentTemplate.hasResourceProperties('AWS::Logs::MetricFilter', { FilterName: `PerPathValidationFailed-${agentId}` })
    agentTemplate.hasResourceProperties('AWS::Logs::MetricFilter', { FilterName: `PerPathScanError-${agentId}` })
    agentTemplate.hasResourceProperties('AWS::Logs::MetricFilter', { FilterName: `UploadCompleted-${agentId}` })
    agentTemplate.hasResourceProperties('AWS::Logs::MetricFilter', { FilterName: `UploadFailed-${agentId}` })
    agentTemplate.hasResourceProperties('AWS::Logs::MetricFilter', { FilterName: `ArchiveCompleted-${agentId}` })
    agentTemplate.hasResourceProperties('AWS::Logs::MetricFilter', { FilterName: `ArchiveFailed-${agentId}` })
    agentTemplate.hasResourceProperties('AWS::Logs::MetricFilter', { FilterName: `DeleteCompleted-${agentId}` })
    agentTemplate.hasResourceProperties('AWS::Logs::MetricFilter', { FilterName: `DeleteFailed-${agentId}` })
  }

  expect(stack.fileLogAgentStacks).toHaveProperty(agent1Id)
  expect(stack.fileLogAgentStacks).toHaveProperty(agent2Id)
  expect(stack.fileLogAgentStacks).not.toHaveProperty(agent3Id)

  verifyFileLogAgentTemplate(stack, agent1Id)
  verifyFileLogAgentTemplate(stack, agent2Id)
})
