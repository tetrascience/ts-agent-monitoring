#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { Agent, TsAgentMonitoringStack } from '../lib/ts-agent-monitoring-stack'
import axios from 'axios'

async function main() {
  const app = new cdk.App()

  const tdpApiBaseUrl = app.node.tryGetContext('tsApiBaseUrl') || process.env.TS_API_BASE_URL || ''
  const authToken = app.node.tryGetContext('tsAuthToken') || process.env.TS_AUTH_TOKEN || ''
  const orgSlug = app.node.tryGetContext('tsOrgSlug') || process.env.TS_ORG_SLUG || ''
  const account = app.node.tryGetContext('accountId') || process.env.CDK_DEFAULT_ACCOUNT || ''
  const region = app.node.tryGetContext('region') || process.env.CDK_DEFAULT_REGION || ''
  const agentId = app.node.tryGetContext('tsAgentId') || process.env.TS_AGENT_ID || ''

  const getAgents = async (agentId?: string): Promise<Agent[]> => {
    try {
      const url = tdpApiBaseUrl + '/v1/agents' + (agentId ? `/${agentId}` : '')
      const response = await axios.get(url, {
        headers: {
          'ts-auth-token': authToken,
          'x-org-slug': orgSlug,
        },
      })
      const normalizedResponse = Array.isArray(response.data) ? response.data : [response.data]
      const agents = normalizedResponse.map((agent: { id: string; type: string; orgSlug: string }) => ({
        id: agent.id,
        type: agent.type,
        orgSlug: agent.orgSlug,
      }))
      return agents
    } catch (error) {
      console.error('Error retrieving agents:', error)
      return []
    }
  }

  const agents = await getAgents(agentId)

  new TsAgentMonitoringStack(app, 'TsAgentMonitoringStack', {
    agents,
    env: { account, region },
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
