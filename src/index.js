import express from "express";
import net from "net";
import cors from "cors";
import Socket from "socket.io";
import createServer from "./server";
import db from "./models/db";
import sensorRouter from "./routes/sensor";
import csvRouter from "./routes/csv";
import config from "./config";
import logger from "./services/logger";

const app = express();
const server = createServer(app);
const io = Socket(server);
app.use(cors());
app.use("/api/sensor", sensorRouter);
app.use("/csv", csvRouter);

const worker = net.createServer();
worker.on("connection", (socket) => {
  let buffered = "";
  function processReceived() {
    let received = buffered.split("\n");
    while (received.length > 1) {
      try {
        const msg = JSON.parse(received[0]);
        if (
          Object.prototype.hasOwnProperty.call(msg, "cmd") &&
          msg.cmd === "new_point"
        ) {
          io.emit("update", msg.data);
        }
      } catch (_) {
        if (config.DEBUG) {
          logger.warn(`bad msg: ${received[0]}`);
        }
      }
      buffered = received.slice(1).join("\n");
      received = buffered.split("\n");
    }
  }
  socket.on("data", (msg) => {
    buffered += msg;
    processReceived();
  });
  socket.on("error", function (err) {
    if (config.DEBUG) {
      logger.warn(`error connect: ${err}`);
    }
  });
});

db.sequelize.sync().then(() => {
  server.listen(config.PORT, config.HOST, () => {
    logger.info("Web listening " + config.HOST + " on port " + config.PORT);
    worker.listen(config.PORT_WORKER, () => {
      logger.info("Worker listening on port " + config.PORT_WORKER);
    });
  });
});
