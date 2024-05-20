import { processEvents } from '../lib/ts-agent-monitoring-stack.fla-metrics-lambda'

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
const mockPutMetricData = jest.fn((...args: any[]) => {
  return {
    promise: jest.fn().mockResolvedValue({}),
  }
})

jest.mock('aws-sdk', () => {
  return {
    CloudWatch: function () {
      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        putMetricData: (...args: any[]) => mockPutMetricData(...args),
      }
    },
    SecretsManager: function () {
      return {
        getSecretValue: function () {
          return {
            promise: jest.fn().mockResolvedValue({ SecretString: 'test' }),
          }
        },
      }
    },
  }
})

const mockGetAgentConfiguration = jest.fn()
jest.mock('axios', () => {
  return {
    default: {
      get: () => mockGetAgentConfiguration(),
    },
  }
})

beforeEach(() => {
  jest.clearAllMocks()
})

test('path matched from configuration', async () => {
  mockGetAgentConfiguration.mockResolvedValue(buildAgentConfigurationResponse(['c:\\test1\\', 'c:\\test2\\']))

  const orgSlug = 'tetrascience'
  const agentId = '55953bf0-acb6-4a45-beb6-cb30b33d4941'
  await processEvents(`/agents/${orgSlug}/${agentId}`, [
    {
      message: JSON.stringify({
        event: {
          timestamp: '',
          component: { id: agentId },
          type: 'agents.filelog.fileUploadCompleted.v1',
          data: { osFilePath: 'c:\\test1\\test.txt', fileLastModifiedDate: '', fileCreateDate: '' },
        },
      }),
      id: '',
      timestamp: 0,
    },
  ])

  expect(mockPutMetricData).toHaveBeenCalledTimes(1)
  const putMetricDataInput = mockPutMetricData.mock.calls[0][0]
  expect(putMetricDataInput.Namespace).toBe('AgentMonitoring')
  const metricData = putMetricDataInput.MetricData
  expect(metricData.length).toBe(1)
  expect(metricData[0].MetricName).toBe('FileUploadLatencyInSeconds')
  expect(metricData[0].Unit).toBe('Seconds')
  expect(metricData[0].Dimensions.length).toBe(3)
  expect(metricData[0].Dimensions.find((d: { Name: string }) => d.Name === 'orgSlug')?.Value).toBe(orgSlug)
  expect(metricData[0].Dimensions.find((d: { Name: string }) => d.Name === 'agentId')?.Value).toBe(agentId)
  expect(metricData[0].Dimensions.find((d: { Name: string }) => d.Name === 'path')?.Value).toBe('c:\\test1\\')
})

function buildAgentConfigurationResponse(paths: string[]) {
  return {
    data: {
      id: 'test',
      by: 'local',
      at: '2024-05-10T13:43:52.729Z',
      config: {
        services_configuration: {
          fileWatcher: {
            paths: paths.map((path) => ({ path })),
          },
        },
      },
    },
  }
}

test('path matched after configuration change', async () => {
  const orgSlug = 'tetrascience'
  const agentId = '55953bf0-acb6-4a45-beb6-cb30b33d4941'

  mockGetAgentConfiguration.mockResolvedValue(buildAgentConfigurationResponse(['c:\\test1\\', 'c:\\test2\\']))
  await processEvents(`/agents/${orgSlug}/${agentId}`, [
    {
      message: JSON.stringify({
        event: {
          timestamp: '',
          component: { id: agentId },
          type: 'agents.filelog.fileUploadCompleted.v1',
          data: { osFilePath: 'c:\\test1\\test.txt', fileLastModifiedDate: '', fileCreateDate: '' },
        },
      }),
      id: '',
      timestamp: 0,
    },
  ])

  mockGetAgentConfiguration.mockResolvedValue(buildAgentConfigurationResponse(['c:\\test3\\']))
  await processEvents(`/agents/${orgSlug}/${agentId}`, [
    {
      message: JSON.stringify({
        event: {
          timestamp: '',
          component: { id: agentId },
          type: 'agents.filelog.fileUploadCompleted.v1',
          data: { osFilePath: 'c:\\test3\\test.txt', fileLastModifiedDate: '', fileCreateDate: '' },
        },
      }),
      id: '',
      timestamp: 0,
    },
  ])

  expect(mockPutMetricData).toHaveBeenCalledTimes(2)
  const putMetricDataInput = mockPutMetricData.mock.calls[1][0]
  expect(putMetricDataInput.Namespace).toBe('AgentMonitoring')
  const metricData = putMetricDataInput.MetricData
  expect(metricData.length).toBe(1)
  expect(metricData[0].MetricName).toBe('FileUploadLatencyInSeconds')
  expect(metricData[0].Unit).toBe('Seconds')
  expect(metricData[0].Dimensions.length).toBe(3)
  expect(metricData[0].Dimensions.find((d: { Name: string }) => d.Name === 'orgSlug')?.Value).toBe(orgSlug)
  expect(metricData[0].Dimensions.find((d: { Name: string }) => d.Name === 'agentId')?.Value).toBe(agentId)
  expect(metricData[0].Dimensions.find((d: { Name: string }) => d.Name === 'path')?.Value).toBe('c:\\test3\\')
})
