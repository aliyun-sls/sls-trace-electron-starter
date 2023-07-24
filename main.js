require("zone.js");
require("zone.js/plugins/zone-patch-electron");
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const {
  SimpleSpanProcessor,
  ConsoleSpanExporter,
  BasicTracerProvider,
} = require("@opentelemetry/sdk-trace-base");
const { NodeTracerProvider } = require("@opentelemetry/sdk-trace-node");

const { trace, propagation, context } = require("@opentelemetry/api");
const opentelemetry = require("@opentelemetry/api");
const { CollectorTraceExporter } = require("@opentelemetry/exporter-collector");
const { HttpInstrumentation } = require("@opentelemetry/instrumentation-http");
const { registerInstrumentations } = require("@opentelemetry/instrumentation");
const { SWTExporterNode } = require("@aliyun-sls/exporter-trace-sls-webtrack");

const exporter = new CollectorTraceExporter();

class AttributeSpanProcessor {
  onStart(span, _context) {
    span.setAttribute("service.version", "0.1.0");
  }
  onEnd(_span) {}
  shutdown() {
    return Promise.resolve();
  }
  forceFlush() {
    return Promise.resolve();
  }
}

const provider = new NodeTracerProvider({
  resource: {
    attributes: {
      "service.name": "electron-main",
    },
  },
});

provider.addSpanProcessor(new AttributeSpanProcessor());
provider.addSpanProcessor(
  new SimpleSpanProcessor(new ConsoleSpanExporter(provider))
);
provider.addSpanProcessor(
  new SimpleSpanProcessor(
    new SWTExporterNode({
      host: "cn-hangzhou.log.aliyuncs.com",
      project: "sls-mall",
      logstore: "sls-mall-raw",
      keepAlive: true,
    })
  )
);

provider.register();

registerInstrumentations({
  instrumentations: [new HttpInstrumentation()],
});

// 必须在 registerInstrumentations 后才能 require("http")
const axios = require("axios");

var tracer = opentelemetry.trace.getTracer("front-end");

const loadContext = (carrier) => propagation.extract(context.active(), carrier);

function registerIpcHandlers() {
  ipcMain.handle("getfile", (event, carrier) => {
    return tracer.startActiveSpan("main:getfile:request", {}, loadContext(carrier), (span) => {
      // mock get file
      span.end();
      return 'file'
    });
  });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });
  const indexPath = path.join(__dirname, "dist", "index.html");
  mainWindow.loadFile(indexPath);
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
