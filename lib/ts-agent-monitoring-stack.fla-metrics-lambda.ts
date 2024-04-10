import { promisify } from 'util'
import { gunzip } from 'zlib'
import type { CloudWatchLogsDecodedData, CloudWatchLogsEvent } from 'aws-lambda'
import { CloudWatch } from 'aws-sdk'

const cloudwatch = new CloudWatch()
const gunzipAsync = promisify(gunzip)

export async function handler(event: CloudWatchLogsEvent) {
  const payload = Buffer.from(event.awslogs.data, 'base64')
  const decompressed = await gunzipAsync(payload)
  const logs: CloudWatchLogsDecodedData = JSON.parse(decompressed.toString('utf8'))

  const { logGroup, logEvents } = logs
  if (!logEvents || logEvents.length === 0) {
    return
  }

  // log group is of the form /agents/<orgslug>/<agentid>
  const logGroupSegments = logGroup.substring(1).split('/')
  const orgSlug = logGroupSegments[1]
  const agentId = logGroupSegments[2]

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
          MetricData: [generateFileLatencyMetricData(orgSlug, event)],
        })
        .promise()
    }
  }
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
    data: { fileLastModifiedDate: string; fileCreateDate: string }
  },
): CloudWatch.MetricDatum {
  const fileLastModifiedDate = Date.parse(event.data.fileLastModifiedDate)
  const fileCreateDate = Date.parse(event.data.fileCreateDate)
  // todo: we can generate another latency using fileScanDate to get a more consistent latency
  const latencyStartDate = fileLastModifiedDate < fileCreateDate ? fileCreateDate : fileLastModifiedDate
  const latencyInSeconds = (Date.parse(event.timestamp) - latencyStartDate) / 1000

  return {
    MetricName: 'FileUploadLatencyInSeconds',
    Dimensions: [
      {
        Name: 'orgSlug',
        Value: orgSlug,
      },
      {
        Name: 'agentId',
        Value: event.component.id,
      },
    ],
    Value: latencyInSeconds,
    Unit: 'Seconds',
  }
}
