import 'zone.js'

import { ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import { ZoneContextManager } from '@opentelemetry/context-zone'
import { context, propagation } from '@opentelemetry/api'
import axios from 'axios'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { SWTExporterBrowser } from '@aliyun-sls/exporter-trace-sls-webtrack'

import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request'

class AttributeSpanProcessor {
  onStart(span, _context) {
    span.setAttribute('service.version', '0.1.0')
  }
  onEnd(_span) {}
  shutdown() {
    return Promise.resolve()
  }
  forceFlush() {
    return Promise.resolve()
  }
}

const provider = new WebTracerProvider({
  resource: {
    attributes: {
      'service.name': 'electron-web',
    },
  },
})
provider.addSpanProcessor(new AttributeSpanProcessor())
provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()))

provider.addSpanProcessor(
  new SimpleSpanProcessor(
    new SWTExporterBrowser({
      host: 'cn-beijing.log.aliyuncs.com',
      project: 'qs-demos',
      logstore: 'sls-mall-raw',
    })
  )
)

provider.register({ contextManager: new ZoneContextManager() })

registerInstrumentations({
  instrumentations: [
    new XMLHttpRequestInstrumentation({
      propagateTraceHeaderCorsUrls: [/^http:\/\/sls-mall/],
    }),
  ],
})

const tracer = provider.getTracer('example-tracer-web')

const runFoo = async (span) => {
  const foo = await window.electron.foo(getCarrier())
  span.end()
  return foo
}

const runBar = async (span) => {
  const bar = await window.electron.bar(getCarrier())
  span.end()
  return bar
}

const getCarrier = () => {
  const carrier = {}
  propagation.inject(context.active(), carrier)
  return carrier
}

const onLoad = async () => {
  axios.get(
    'http://sls-mall.caa227ac081f24f1a8556f33d69b96c99.cn-beijing.alicontainer.com/catalogue/03fef6ac-1896-4ce8-bd69-b798f85c6e0b'
  )

  await tracer.startActiveSpan('1. onLoad', async (span) => {
    console.log('STARTING', getCarrier())
    const fooResult = await tracer.startActiveSpan('2. runFoo', runFoo)
    console.log('DONE FOO', getCarrier())
    const barResult = await tracer.startActiveSpan('3. runBar', runBar)
    console.log('DONE BAR', getCarrier())
    span.end()
    console.log('COMPLETE', getCarrier(), { fooResult, barResult })
  })
}

window.addEventListener('load', onLoad)
