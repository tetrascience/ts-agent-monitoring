import { promisify } from 'util'
import { gunzip } from 'zlib'
import type { CloudWatchLogsDecodedData, CloudWatchLogsEvent, CloudWatchLogsLogEvent } from 'aws-lambda'
import { CloudWatch, SecretsManager } from 'aws-sdk'
import { createHash } from 'crypto'
import axios from 'axios'

const TETRASCIENCE_API_URL = process.env.TETRASCIENCE_API_URL
const TETRASCIENCE_AUTH_TOKEN_SECRET_ARN = process.env.TETRASCIENCE_AUTH_TOKEN_SECRET_ARN || ''

const cloudwatch = new CloudWatch()
const secretsmanager = new SecretsManager()

const gunzipAsync = promisify(gunzip)
const configurationByAgentId: { [index: string]: { configurationChecksum: string; pathsTrie: PathTrieNode } } = {}

interface AgentConfigurationApiResponse {
  id: string
  config: { services_configuration: { fileWatcher: { paths: { path: string }[] } } }
}

export async function handler(event: CloudWatchLogsEvent) {
  const payload = Buffer.from(event.awslogs.data, 'base64')
  const decompressed = await gunzipAsync(payload)
  const logs: CloudWatchLogsDecodedData = JSON.parse(decompressed.toString('utf8'))

  const { logGroup, logEvents } = logs
  if (!logEvents || logEvents.length === 0) {
    return
  }

  await processEvents(logGroup, logEvents)
}

export async function processEvents(logGroup: string, logEvents: CloudWatchLogsLogEvent[]) {
  // log group is of the form /agents/<orgslug>/<agentid>
  const logGroupSegments = logGroup.substring(1).split('/')
  const orgSlug = logGroupSegments[1]
  const agentId = logGroupSegments[2]

  // load fla agent configuration and construct trie to match paths
  const authToken = await secretsmanager
    .getSecretValue({ SecretId: TETRASCIENCE_AUTH_TOKEN_SECRET_ARN })
    .promise()
    .then((response) => response.SecretString)

  if (!authToken) {
    throw new Error(
      'Tetrascience Auth Token not found in Secrets Manager.  Ensure it is set in Secrets Manager with ARN ' +
        TETRASCIENCE_AUTH_TOKEN_SECRET_ARN,
    )
  }
  const configuration = await getAgentConfiguration(orgSlug, authToken, agentId)
  const configurationJson = JSON.stringify(configuration)
  const configurationChecksum = createHash('md5').update(configurationJson).digest('hex')

  if (
    !configurationByAgentId[agentId] ||
    configurationByAgentId[agentId].configurationChecksum !== configurationChecksum
  ) {
    const paths = configuration.config.services_configuration.fileWatcher.paths.map(
      (fileWatcherPath: { path: string }) => fileWatcherPath.path,
    )
    const pathsTrie = buildPathsTrie(paths)
    configurationByAgentId[agentId] = {
      configurationChecksum: configurationChecksum,
      pathsTrie: pathsTrie,
    }
  }

  const pathsTrie = configurationByAgentId[agentId].pathsTrie

  for (const logEvent of logEvents) {
    const logMessageJson = JSON.parse(logEvent.message)
    const event = logMessageJson.event
    if (!event) {
      continue
    }

    if (event.type === 'agents.filelog.scanCompleted.v1') {
      const durationInMilliseconds = parseDurationToMilliseconds(event.data.duration)

      await cloudwatch
        .putMetricData({
          Namespace: 'AgentMonitoring',
          MetricData: [
            {
              MetricName: 'PerPathScanDurationInMs',
              Dimensions: [
                {
                  Name: 'orgSlug',
                  Value: orgSlug,
                },
                {
                  Name: 'agentId',
                  Value: agentId,
                },
                {
                  Name: 'path',
                  Value: event.data.path,
                },
              ],
              Value: durationInMilliseconds,
              Unit: 'Milliseconds',
            },
          ],
        })
        .promise()
    } else if (event.type === 'agents.filelog.fileUploadCompleted.v1') {
      await cloudwatch
        .putMetricData({
          Namespace: 'AgentMonitoring',
          MetricData: [generateFileLatencyMetricData(orgSlug, event, pathsTrie)],
        })
        .promise()
    }
  }
}

async function getAgentConfiguration(
  orgSlug: string,
  authToken: string,
  agentId: string,
): Promise<AgentConfigurationApiResponse> {
  let baseUrl = TETRASCIENCE_API_URL
  if (!baseUrl?.endsWith('/')) {
    baseUrl = baseUrl + '/'
  }
  const url = `${baseUrl}v1/agents/${agentId}/configuration`
  const response = await axios.get(url, {
    headers: {
      'Content-Type': 'application/json',
      'x-org-slug': orgSlug,
      'ts-auth-token': authToken,
    },
  })
  return response.data
}

interface PathTrieNode {
  children: { [key: string]: PathTrieNode }
  path?: string
}

function buildPathsTrie(paths: string[]): PathTrieNode {
  const trie: PathTrieNode = { children: {} }
  for (const path of paths) {
    let node = trie
    for (const segment of splitPath(path)) {
      const segmentLower = segment.toLowerCase()
      if (!node.children[segmentLower]) {
        node.children[segmentLower] = { children: {} }
      }
      node = node.children[segmentLower]
    }

    if (node) {
      node.path = path
    }
  }
  return trie
}

// This function converts a string representing a timespan in the format `hh:mm:ss.ffffff` to milliseconds.
// e.g. 00:00:00.234980 -> 235ms
function parseDurationToMilliseconds(duration: string): number {
  if (!duration) {
    return 0
  }

  const [hours, minutes, seconds] = duration.toString().split(':')
  const milliseconds = parseInt(hours) * 3600000 + parseInt(minutes) * 60000 + parseFloat(seconds) * 1000
  return milliseconds
}

function generateFileLatencyMetricData(
  orgSlug: string,
  event: {
    timestamp: string
    component: { type: string; id: string }
    data: { osFilePath?: string; osFolderPath?: string; fileLastModifiedDate: string; fileCreateDate: string }
  },
  pathsTrie: PathTrieNode,
): CloudWatch.MetricDatum {
  const fileLastModifiedDate = Date.parse(event.data.fileLastModifiedDate)
  const fileCreateDate = Date.parse(event.data.fileCreateDate)
  // todo: we can generate another latency using fileScanDate to get a more consistent latency
  const latencyStartDate = fileLastModifiedDate < fileCreateDate ? fileCreateDate : fileLastModifiedDate
  const latencyInSeconds = (Date.parse(event.timestamp) - latencyStartDate) / 1000

  // determine the path this event is for using the paths trie
  const filePath = event.data.osFilePath || event.data.osFolderPath || ''
  let path = ''
  let node = pathsTrie
  for (const segment of splitPath(filePath)) {
    const segmentLower = segment.toLowerCase()
    if (!node.children[segmentLower]) {
      break
    }
    node = node.children[segmentLower]
    if (node.path) {
      path = node.path
      break
    }
  }

  const dimensions = [
    {
      Name: 'orgSlug',
      Value: orgSlug,
    },
    {
      Name: 'agentId',
      Value: event.component.id,
    },
  ]

  if (path) {
    dimensions.push({
      Name: 'path',
      Value: path,
    })
  }

  return {
    MetricName: 'FileUploadLatencyInSeconds',
    Dimensions: dimensions,
    Value: latencyInSeconds,
    Unit: 'Seconds',
  }
}

/**
 * Splits a given path into an array of non-empty, trimmed segments.
 *
 * @param path - The path to split.
 * @returns An array of path segments.
 */
function splitPath(path: string): string[] {
  return path
    .split('\\')
    .map((segment) => segment.trim())
    .filter((segment) => segment)
}
